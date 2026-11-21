import {
  forwardRef,
  HttpException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AppGateway } from 'src/app.gateway';
import { JwtAuthDto } from 'src/auth/dto/jwt-auth.dto';
import { getNextGroupsInRoom } from 'src/competition/groupChange';
import { publicUserSelect } from 'src/constants';
import { DbService } from 'src/db/db.service';
import { groupIdToRoundId } from 'src/device/stationRounds';
import { Competition as Wcif } from 'wcif-helpers';

import {
  DelegateGrant,
  DelegateGrantPermission,
  Role,
  StaffRole,
} from '../generated/prisma/client';
import { findUncoveredGroups, UncoveredGroup } from './delegateCoverage';
import {
  ACTION_LABELS,
  GrantAction,
  groupName,
  isGrantRunning,
  RESOLVE_INCIDENT,
} from './delegateGrantRules';
import { GiveDelegateGrantDto } from './dto/giveDelegateGrant.dto';

/** A grant whose group is running, with what it covers right now */
export interface ActiveGrant extends DelegateGrant {
  activatedAt: Date;
  roundId: string;
  /** Rooms running the group */
  roomIds: string[];
  /** Competitors it covers: assigned to the group, or solved in it */
  personIds: Set<string>;
}

/** What an action is about: a result, an attempt, or a competitor in a round */
export type GrantTarget =
  | { resultId: string }
  | { attemptId: string }
  | { extraGrantId: string }
  | { personId: string; roundId: string };

export interface RecordedAction {
  kind: GrantAction | string;
  summary: string;
  /** The attempt it was about, if one; kept after the attempt is deleted */
  attemptId?: string;
  /** Looked up before a change that can delete the result itself */
  result?: { id: string; person: { name: string } } | null;
}

export type GroupEnteredAt = (roomId: string, groupId: string) => number;

const isDelegate = (user: Pick<JwtAuthDto, 'roles'>) =>
  user.roles.includes(Role.DELEGATE) || user.roles.includes(Role.ADMIN);

@Injectable()
export class DelegateGrantService {
  private logger = new Logger(DelegateGrantService.name);

  constructor(
    private readonly prisma: DbService,
    @Inject(forwardRef(() => AppGateway))
    private readonly appGateway: AppGateway,
  ) {}

  /** When a room started a group, in ms; RoomsService provides it */
  private groupEnteredAt: GroupEnteredAt = () => Date.now();

  /**
   * RoomsService hands this over when the app starts: it knows when each
   * room started each group, and it depends on this service, so this one
   * can't depend on it back.
   */
  useGroupEnteredAt(source: GroupEnteredAt) {
    this.groupEnteredAt = source;
  }

  /**
   * When the group started in the rooms running it, which is where a grant's
   * scope starts: incidents already raised in the group count too, however
   * late the access was given.
   */
  private groupStartedAt(
    groupId: string,
    rooms: { id: string; currentGroupIds: string[] }[],
  ) {
    const times = rooms
      .filter((room) => room.currentGroupIds.includes(groupId))
      .map((room) => this.groupEnteredAt(room.id, groupId));
    return times.length ? new Date(Math.min(...times)) : new Date();
  }

  /* ===== Giving and ending ===== */

  async giveGrant(data: GiveDelegateGrantDto, givenById: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true, roles: true },
    });
    if (!user) throw new HttpException('User not found', 404);
    if (isDelegate(user)) {
      throw new HttpException(
        'This user is a delegate already and can do all of this',
        400,
      );
    }
    const permissions = [...new Set(data.permissions)];
    // One open grant per user and group: giving access again changes it
    const open = await this.prisma.delegateGrant.findFirst({
      where: { userId: data.userId, groupId: data.groupId, endedAt: null },
    });
    const grant = open
      ? await this.prisma.delegateGrant.update({
          where: { id: open.id },
          data: { permissions },
        })
      : await this.prisma.delegateGrant.create({
          data: {
            userId: data.userId,
            groupId: data.groupId,
            permissions,
            createdById: givenById,
          },
        });
    await this.syncWithRooms();
    this.notifyChanged(grant.userId);
    return this.prisma.delegateGrant.findUnique({ where: { id: grant.id } });
  }

  async endGrant(id: string, endedById: string) {
    const grant = await this.prisma.delegateGrant.findUnique({
      where: { id },
    });
    if (!grant) throw new HttpException('Delegate access not found', 404);
    if (grant.endedAt) return grant;
    const ended = await this.prisma.delegateGrant.update({
      where: { id },
      data: { endedAt: new Date(), endedById },
    });
    this.notifyChanged(grant.userId);
    return ended;
  }

  async getGrants(groupId?: string) {
    await this.syncWithRooms();
    const grants = await this.prisma.delegateGrant.findMany({
      where: groupId ? { groupId } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, fullName: true, username: true } },
        createdBy: publicUserSelect,
        endedBy: publicUserSelect,
        _count: { select: { actions: true } },
      },
    });
    return grants.map(({ _count, ...grant }) => ({
      ...grant,
      groupName: groupName(grant.groupId),
      actionCount: _count.actions,
    }));
  }

  async getActions(grantId: string) {
    return this.prisma.delegateGrantAction.findMany({
      where: { grantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** The caller's grants that are active or waiting for their group */
  async getMine(userId: string) {
    await this.syncWithRooms();
    const [grants, rooms] = await Promise.all([
      this.prisma.delegateGrant.findMany({
        where: { userId, endedAt: null },
        orderBy: { createdAt: 'asc' },
        include: { createdBy: publicUserSelect },
      }),
      this.prisma.room.findMany({ select: { currentGroupIds: true } }),
    ]);
    return grants.map((grant) => ({
      ...grant,
      groupName: groupName(grant.groupId),
      roundId: groupIdToRoundId(grant.groupId),
      active: isGrantRunning(grant, rooms),
    }));
  }

  /* ===== Following the rooms ===== */

  /**
   * Activates grants whose group a room started and ends those whose group
   * stopped. Called after rooms change groups, and before every access
   * check, so a room changed any other way can't leave a grant working.
   */
  async syncWithRooms() {
    const [grants, rooms] = await Promise.all([
      this.prisma.delegateGrant.findMany({ where: { endedAt: null } }),
      this.prisma.room.findMany({
        select: { id: true, currentGroupIds: true },
      }),
    ]);
    const now = new Date();
    const changedUserIds = new Set<string>();
    for (const grant of grants) {
      const running = isGrantRunning(grant, rooms);
      if (running && !grant.activatedAt) {
        await this.prisma.delegateGrant.update({
          where: { id: grant.id },
          data: { activatedAt: this.groupStartedAt(grant.groupId, rooms) },
        });
        changedUserIds.add(grant.userId);
      } else if (!running && grant.activatedAt) {
        // Ended for good: starting the group again doesn't bring it back
        await this.prisma.delegateGrant.update({
          where: { id: grant.id },
          data: { endedAt: now },
        });
        changedUserIds.add(grant.userId);
      }
    }
    for (const userId of changedUserIds) this.notifyChanged(userId);
  }

  /* ===== Groups with no free delegate (SPEC-015) ===== */

  // Groups delegates were told about, so a group is announced only once
  private announcedUncoveredGroupIds = new Set<string>();

  /**
   * Running and next groups every WCIF delegate competes in, which nobody
   * has delegate access for yet
   */
  async getUncoveredGroups(): Promise<UncoveredGroup[]> {
    const [competition, rooms, openGrants] = await Promise.all([
      this.prisma.competition.findFirst({ select: { wcif: true } }),
      this.prisma.room.findMany({
        select: { name: true, currentGroupIds: true },
      }),
      this.prisma.delegateGrant.findMany({
        where: { endedAt: null },
        select: { groupId: true },
      }),
    ]);
    const wcif = competition?.wcif as unknown as Wcif | undefined;
    if (!wcif?.schedule || !wcif.persons) return [];
    return findUncoveredGroups(
      wcif,
      rooms.map((room) => ({
        ...room,
        nextGroupIds: getNextGroupsInRoom(
          room.currentGroupIds,
          room.name,
          wcif,
        ),
      })),
      new Set(openGrants.map((grant) => grant.groupId)),
    );
  }

  /**
   * After rooms change groups: tells delegates about groups that just
   * became next (or started) with no delegate free, so someone can be
   * given access before the group starts. Each group once.
   */
  async announceUncoveredGroups() {
    const groups = await this.getUncoveredGroups();
    const fresh = groups.filter(
      (group) => !this.announcedUncoveredGroupIds.has(group.groupId),
    );
    if (fresh.length === 0) return;
    fresh.forEach((group) =>
      this.announcedUncoveredGroupIds.add(group.groupId),
    );
    this.appGateway.handleNoFreeDelegate(fresh);
  }

  /* ===== Access checks ===== */

  /** A delegate or admin: everything is allowed, grants don't matter */
  isDelegateUser(user: Pick<JwtAuthDto, 'roles'>) {
    return isDelegate(user);
  }

  /** Delegates, admins, and anyone holding a grant that hasn't ended */
  async mightBeAllowed(user: JwtAuthDto) {
    if (isDelegate(user)) return true;
    const open = await this.prisma.delegateGrant.count({
      where: { userId: user.userId, endedAt: null },
    });
    return open > 0;
  }

  /** The user's grants whose group is running, with their scope */
  async getActiveGrants(userId: string): Promise<ActiveGrant[]> {
    await this.syncWithRooms();
    const [grants, rooms] = await Promise.all([
      this.prisma.delegateGrant.findMany({
        where: { userId, endedAt: null, activatedAt: { not: null } },
      }),
      this.prisma.room.findMany({
        select: { id: true, currentGroupIds: true },
      }),
    ]);
    return Promise.all(
      grants.map(async (grant) => {
        const roundId = groupIdToRoundId(grant.groupId);
        const roomIds = rooms
          .filter((room) => room.currentGroupIds.includes(grant.groupId))
          .map((room) => room.id);
        const [assigned, solved] = await Promise.all([
          this.prisma.staffActivity.findMany({
            where: {
              groupId: grant.groupId,
              role: StaffRole.COMPETITOR,
              isAssigned: true,
            },
            select: { personId: true },
          }),
          // Competitors often solve in another group than their own without
          // anyone changing the assignment: a station in the room counts
          this.prisma.result.findMany({
            where: {
              roundId,
              attempts: {
                some: {
                  createdAt: { gte: grant.activatedAt },
                  device: { roomId: { in: roomIds } },
                },
              },
            },
            select: { personId: true },
          }),
        ]);
        return {
          ...grant,
          activatedAt: grant.activatedAt as Date,
          roundId,
          roomIds,
          personIds: new Set(
            [...assigned, ...solved].map((row) => row.personId),
          ),
        };
      }),
    );
  }

  /**
   * Lets the action through, or refuses it saying why. Returns the grant it
   * went through under, or null for a delegate, whose actions aren't logged
   * here.
   */
  async authorize(
    user: JwtAuthDto,
    action: GrantAction,
    target: GrantTarget,
  ): Promise<ActiveGrant | null> {
    if (isDelegate(user)) return null;
    const { personId, roundId } = await this.resolveTarget(target);
    const active = await this.getActiveGrants(user.userId);
    if (active.length === 0) {
      throw new HttpException(await this.noActiveGrantReason(user.userId), 403);
    }
    const covering = active.filter(
      (grant) => grant.roundId === roundId && grant.personIds.has(personId),
    );
    if (covering.length === 0) {
      throw new HttpException(
        `Your delegate access for ${groupName(active[0].groupId)} doesn't cover this competitor`,
        403,
      );
    }
    const allowed = covering.find(
      (grant) =>
        action === RESOLVE_INCIDENT ||
        grant.permissions.includes(action as DelegateGrantPermission),
    );
    if (!allowed) {
      throw new HttpException(
        `Your delegate access for ${groupName(covering[0].groupId)} doesn't include ${ACTION_LABELS[action]}`,
        403,
      );
    }
    return allowed;
  }

  /**
   * authorize for an action touching several attempts or results: every one
   * must be covered, by the same grant
   */
  async authorizeAll(
    user: JwtAuthDto,
    action: GrantAction,
    targets: GrantTarget[],
  ): Promise<ActiveGrant | null> {
    let grant: ActiveGrant | null = null;
    for (const target of targets) {
      const allowed = await this.authorize(user, action, target);
      if (grant && allowed && allowed.id !== grant.id) {
        throw new HttpException(
          'These attempts are covered by different delegate access',
          403,
        );
      }
      grant = allowed;
    }
    return grant;
  }

  /**
   * For reads: whether the user may see this result at all. Delegates may;
   * a grantee only within one of their active grants.
   */
  async authorizeRead(user: JwtAuthDto, target: GrantTarget) {
    return this.authorize(user, RESOLVE_INCIDENT, target);
  }

  /** Which of these incidents a grantee may see; all of them for a delegate */
  async filterVisible<
    T extends { result: { personId: string; roundId: string } },
  >(user: JwtAuthDto, items: T[]): Promise<T[]> {
    if (isDelegate(user)) return items;
    const active = await this.getActiveGrants(user.userId);
    return items.filter((item) =>
      active.some(
        (grant) =>
          grant.roundId === item.result.roundId &&
          grant.personIds.has(item.result.personId),
      ),
    );
  }

  /**
   * Logs what a grantee did, for delegates to look over. Nothing for a
   * delegate (grant null). Call it after the change went through.
   */
  async record(
    grant: ActiveGrant | null,
    target: GrantTarget,
    action: RecordedAction,
  ) {
    if (!grant) return;
    try {
      const result =
        action.result !== undefined
          ? action.result
          : await this.findResult(target);
      const recorded = await this.prisma.delegateGrantAction.create({
        data: {
          grantId: grant.id,
          kind: action.kind,
          summary: action.summary,
          resultId: result?.id ?? null,
          attemptId: action.attemptId ?? null,
          personName: result?.person.name ?? null,
        },
      });
      this.appGateway.handleDelegateGrantAction(recorded);
    } catch (e) {
      // The change itself went through; losing its log line mustn't undo it
      this.logger.error(`Could not record a delegate grant action: ${e}`);
    }
  }

  async findResult(target: GrantTarget) {
    const select = {
      id: true,
      personId: true,
      roundId: true,
      person: { select: { name: true } },
    };
    if ('personId' in target) {
      return this.prisma.result.findFirst({
        where: {
          personId: target.personId,
          roundId: target.roundId,
          removedAt: undefined,
        },
        select,
      });
    }
    let resultId: string | undefined;
    if ('resultId' in target) {
      resultId = target.resultId;
    } else if ('attemptId' in target) {
      resultId = (
        await this.prisma.attempt.findUnique({
          where: { id: target.attemptId },
          select: { resultId: true },
        })
      )?.resultId;
    } else {
      resultId = (
        await this.prisma.extraGrant.findUnique({
          where: { id: target.extraGrantId },
          select: { resultId: true },
        })
      )?.resultId;
    }
    if (!resultId) return null;
    return this.prisma.result.findFirst({
      where: { id: resultId, removedAt: undefined },
      select,
    });
  }

  private async resolveTarget(
    target: GrantTarget,
  ): Promise<{ personId: string; roundId: string }> {
    if ('personId' in target) return target;
    const result = await this.findResult(target);
    if (!result) throw new HttpException('Not found', 404);
    return result;
  }

  async noActiveGrantReason(userId: string) {
    const [waiting, lastEnded] = await Promise.all([
      this.prisma.delegateGrant.findFirst({
        where: { userId, endedAt: null },
      }),
      this.prisma.delegateGrant.findFirst({
        where: { userId, endedAt: { not: null } },
        orderBy: { endedAt: 'desc' },
      }),
    ]);
    if (waiting) {
      return `Your delegate access for ${groupName(waiting.groupId)} starts when the group starts`;
    }
    if (lastEnded) {
      return `Your delegate access for ${groupName(lastEnded.groupId)} has ended`;
    }
    return 'Only delegates can do this';
  }

  private notifyChanged(userId: string) {
    this.appGateway.handleDelegateGrantChanged(userId);
  }
}
