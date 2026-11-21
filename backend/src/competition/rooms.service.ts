import {
  forwardRef,
  HttpException,
  Inject,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import { DelegateGrantService } from 'src/delegate-grant/delegateGrant.service';
import { DeviceService } from 'src/device/device.service';
import { isFirstGroupOfDay } from 'src/device/tutorial';
import { IntegratedLiveRoundsService } from 'src/integrated-live/integratedLiveRounds.service';
import { SocketController } from 'src/socket/socket.controller';
import { Competition as Wcif } from 'wcif-helpers';

import { Attempt } from '../generated/prisma/client';
import { UpdateRoomsDto } from './dto/updateCurrentRound.dto';
import { calculateGroupProgress, getGroupCompetitorIds } from './groupProgress';

export class RoomsService implements OnModuleInit {
  constructor(
    @Inject(forwardRef(() => DbService))
    private readonly prisma: DbService,
    @Inject(forwardRef(() => SocketController))
    private readonly socketController: SocketController,
    @Inject(forwardRef(() => IntegratedLiveRoundsService))
    private readonly integratedLiveRounds: IntegratedLiveRoundsService,
    @Inject(forwardRef(() => DeviceService))
    private readonly deviceService: DeviceService,
    @Inject(forwardRef(() => DelegateGrantService))
    private readonly delegateGrants: DelegateGrantService,
  ) {}

  private readonly logger = new Logger('RoomsService');

  private readonly startedAt = Date.now();

  onModuleInit() {
    // Delegate access for a group covers it from when the room started it
    this.delegateGrants.useGroupEnteredAt((roomId, groupId) =>
      this.getGroupEnteredAt(roomId, groupId),
    );
  }
  // "roomId|groupId" -> when the room started running the group
  private groupEnteredAt = new Map<string, number>();

  async getAllRooms() {
    return this.prisma.room.findMany();
  }

  /** Results entered vs expected for every room's current groups */
  async getRoomsProgress() {
    const [rooms, competition] = await Promise.all([
      this.prisma.room.findMany(),
      this.prisma.competition.findFirst(),
    ]);
    if (!competition) return [];
    const wcif = competition.wcif as unknown as Wcif;

    return Promise.all(
      rooms.map(async (room) => ({
        roomId: room.id,
        groups: await Promise.all(
          room.currentGroupIds.map(async (groupId) => {
            const results = await this.prisma.result.findMany({
              where: {
                roundId: groupId.split('-g')[0],
                person: {
                  registrantId: { in: getGroupCompetitorIds(wcif, groupId) },
                },
              },
              select: {
                attempts: true,
                person: { select: { registrantId: true } },
              },
            });
            const attemptsByRegistrantId = new Map<number, Attempt[]>(
              results.map((result) => [
                result.person.registrantId,
                result.attempts,
              ]),
            );
            return calculateGroupProgress(
              wcif,
              groupId,
              attemptsByRegistrantId,
            );
          }),
        ),
      })),
    );
  }

  async updateRooms(data: UpdateRoomsDto) {
    data.rooms.forEach((room) => this.assertValidGroups(room.currentGroupIds));
    const existing = await this.prisma.room.findMany({
      where: { id: { in: data.rooms.map((room) => room.id) } },
      select: { id: true, startedGroupIds: true, currentGroupIds: true },
    });
    const transactions = data.rooms.map((room) => {
      const startedBefore =
        existing.find((r) => r.id === room.id)?.startedGroupIds ?? [];
      return this.prisma.room.update({
        where: {
          id: room.id,
        },
        data: this.groupsData(room.currentGroupIds, startedBefore),
      });
    });
    await this.prisma.$transaction(transactions);
    await this.afterGroupsChanged(data.rooms, existing);
    this.endTutorialsOnGroupStart(data.rooms, existing);
    return {
      message: 'Rooms updated',
    };
  }

  /**
   * Moves one room from the groups it had when the caller read it to new
   * ones, the same way as updateRooms. The write only goes through if the
   * room still runs exactly those groups, so a change made in the panel
   * meanwhile is kept; false then.
   */
  async switchRoomGroups(
    roomId: string,
    fromGroupIds: string[],
    toGroupIds: string[],
  ) {
    this.assertValidGroups(toGroupIds);
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { startedGroupIds: true },
    });
    if (!room) return false;
    const { count } = await this.prisma.room.updateMany({
      where: { id: roomId, currentGroupIds: { equals: fromGroupIds } },
      data: this.groupsData(toGroupIds, room.startedGroupIds),
    });
    if (count === 0) return false;
    const after = [{ id: roomId, currentGroupIds: toGroupIds }];
    const before = [
      {
        id: roomId,
        currentGroupIds: fromGroupIds,
        startedGroupIds: room.startedGroupIds,
      },
    ];
    await this.afterGroupsChanged(after, before);
    this.endTutorialsOnGroupStart(after, before);
    return true;
  }

  /**
   * When the room started running the group, for telling a group nobody has
   * solved in for a while from one the room only just reached. Kept in
   * memory: after a restart it is the time the backend started, so a group
   * is never treated as quiet sooner than it would have been.
   */
  getGroupEnteredAt(roomId: string, groupId: string) {
    return this.groupEnteredAt.get(`${roomId}|${groupId}`) ?? this.startedAt;
  }

  private assertValidGroups(groupIds: string[]) {
    //If there are 2 or more groups in the room with same roundId
    const roundIds = [];
    const eventIds = [];
    for (const groupId of groupIds) {
      const eventId = groupId.split('-r')[0];
      if (eventIds.includes(eventId)) {
        throw new HttpException(
          'There are 2 or more groups in the room from the same event',
          400,
        );
      }
      eventIds.push(eventId);
      const roundId = groupId.split('-g')[0];
      if (roundIds.includes(roundId)) {
        throw new HttpException(
          'There are 2 or more groups in the room from the same round',
          400,
        );
      }
      roundIds.push(roundId);
    }
  }

  private groupsData(currentGroupIds: string[], startedBefore: string[]) {
    return {
      currentGroupIds,
      startedGroupIds: [...new Set([...startedBefore, ...currentGroupIds])],
    };
  }

  /** Once the new groups are saved: entry times, stations, live results */
  private async afterGroupsChanged(
    rooms: { id: string; currentGroupIds: string[] }[],
    before: { id: string; currentGroupIds?: string[] }[],
  ) {
    const now = Date.now();
    for (const room of rooms) {
      const previous =
        before.find((r) => r.id === room.id)?.currentGroupIds ?? [];
      for (const groupId of previous) {
        if (!room.currentGroupIds.includes(groupId)) {
          this.groupEnteredAt.delete(`${room.id}|${groupId}`);
        }
      }
      for (const groupId of room.currentGroupIds) {
        if (!previous.includes(groupId)) {
          this.groupEnteredAt.set(`${room.id}|${groupId}`, now);
        }
      }
    }
    await this.socketController.sendServerStatus();
    // Delegate access for a group starts and ends with it (SPEC-013); a
    // failure here mustn't fail the group change, access checks sync again
    await this.delegateGrants.syncWithRooms().catch(() => undefined);
    // Not awaited: a group every delegate competes in (SPEC-015)
    this.delegateGrants.announceUncoveredGroups().catch((e) => {
      this.logger.error('Failed to check delegates for the next groups');
      this.logger.error(e);
    });
    // Not awaited: starting a group mustn't wait for the WCA
    const startedRoundIds = new Set(
      rooms.flatMap((room) =>
        room.currentGroupIds.map((groupId) => groupId.split('-g')[0]),
      ),
    );
    for (const roundId of startedRoundIds) {
      this.integratedLiveRounds.onRoundStarted(roundId).catch(() => undefined);
    }
  }

  /**
   * A room starting a group: its first group of the day ends tutorial mode on
   * its stations, a later one reminds delegates of any still on (SPEC-012).
   * Not awaited, so starting a group doesn't wait for it
   */
  private endTutorialsOnGroupStart(
    rooms: { id: string; currentGroupIds: string[] }[],
    before: {
      id: string;
      currentGroupIds?: string[];
      startedGroupIds?: string[];
    }[],
  ) {
    const startingRooms = rooms
      .map((room) => ({
        room,
        previous: before.find((r) => r.id === room.id),
      }))
      .filter(({ room, previous }) =>
        room.currentGroupIds.some(
          (groupId) => !(previous?.currentGroupIds ?? []).includes(groupId),
        ),
      );
    if (startingRooms.length === 0) return;
    const handle = async () => {
      const competition = await this.prisma.competition.findFirst({
        select: { wcif: true },
      });
      const wcif = competition?.wcif as unknown as Wcif | undefined;
      for (const { room, previous } of startingRooms) {
        const startedBefore = previous?.startedGroupIds ?? [];
        // Without a schedule, only the room's very first group counts
        const isFirstOfDay = wcif?.schedule
          ? isFirstGroupOfDay(wcif, startedBefore)
          : startedBefore.length === 0;
        await this.deviceService.handleRoomGroupsStarted(room.id, isFirstOfDay);
      }
    };
    handle().catch((e) => {
      this.logger.error('Failed to update tutorial stations on group start');
      this.logger.error(e);
    });
  }
}
