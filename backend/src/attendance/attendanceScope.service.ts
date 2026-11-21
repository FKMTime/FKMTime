import { ForbiddenException, HttpException, Injectable } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import { Competition as Wcif } from 'wcif-helpers';

import {
  ALL_ROOMS,
  AttendanceScope,
  hasFullAttendanceAccess,
  outOfScopeMessage,
  roomsGroupIds,
  scopeIncludes,
} from './attendanceScope';

/**
 * Which groups' attendance a user may read and change (SPEC-016). Roles and
 * rooms are read on every call, so a change takes effect on the next request.
 */
@Injectable()
export class AttendanceScopeService {
  constructor(private readonly prisma: DbService) {}

  async scopeFor(userId: string): Promise<AttendanceScope> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        roles: true,
        stageLeadRooms: {
          select: {
            room: {
              select: {
                id: true,
                name: true,
                currentGroupIds: true,
                startedGroupIds: true,
              },
            },
          },
        },
      },
    });
    if (!user) throw new HttpException('User not found', 401);
    const rooms = user.stageLeadRooms.map(({ room }) => room);
    // No rooms is all rooms: every stage lead from before SPEC-016
    if (hasFullAttendanceAccess(user.roles) || rooms.length === 0) {
      return ALL_ROOMS;
    }
    const competition = await this.prisma.competition.findFirst({
      select: { wcif: true },
    });
    const wcif = (competition?.wcif ?? null) as unknown as Wcif | null;
    return {
      allRooms: false,
      rooms: rooms.map(({ id, name }) => ({ id, name })),
      groupIds: roomsGroupIds(rooms, wcif),
    };
  }

  /** The scope as the panel reads it */
  async describe(userId: string) {
    const scope = await this.scopeFor(userId);
    return {
      allRooms: scope.allRooms,
      rooms: scope.rooms,
      groupIds: [...scope.groupIds],
    };
  }

  async assertGroup(userId: string, groupId: string) {
    const scope = await this.scopeFor(userId);
    this.assertIncludes(scope, groupId);
    return scope;
  }

  /** For an attendance row: its group must be in scope */
  async assertActivity(userId: string, activityId: string) {
    const scope = await this.scopeFor(userId);
    if (scope.allRooms) return;
    const activity = await this.prisma.staffActivity.findUnique({
      where: { id: activityId },
      select: { groupId: true },
    });
    // A missing row is the endpoint's 404 to give
    if (activity) this.assertIncludes(scope, activity.groupId);
  }

  /** At least one of the groups in scope */
  async assertAnyGroup(userId: string, groupIds: string[]) {
    const scope = await this.scopeFor(userId);
    if (scope.allRooms) return;
    if (!groupIds.some((groupId) => scope.groupIds.has(groupId))) {
      throw new ForbiddenException(outOfScopeMessage(scope.rooms));
    }
  }

  /** At least one group of the round in scope */
  async assertRound(userId: string, roundId: string) {
    const scope = await this.scopeFor(userId);
    if (scope.allRooms) return;
    if (![...scope.groupIds].some((id) => id.startsWith(`${roundId}-g`))) {
      throw new ForbiddenException(outOfScopeMessage(scope.rooms));
    }
  }

  private assertIncludes(scope: AttendanceScope, groupId: string) {
    if (!scope.allRooms && !scopeIncludes(scope, groupId)) {
      throw new ForbiddenException(outOfScopeMessage(scope.rooms));
    }
  }
}
