import { forwardRef, HttpException, Inject } from '@nestjs/common';
import { Attempt } from '@prisma/client';
import { DbService } from 'src/db/db.service';
import { SocketController } from 'src/socket/socket.controller';
import { Competition as Wcif } from 'wcif-helpers';

import { UpdateRoomsDto } from './dto/updateCurrentRound.dto';
import { calculateGroupProgress, getGroupCompetitorIds } from './groupProgress';

export class RoomsService {
  constructor(
    @Inject(forwardRef(() => DbService))
    private readonly prisma: DbService,
    @Inject(forwardRef(() => SocketController))
    private readonly socketController: SocketController,
  ) {}

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
    const transactions = [];
    for (const room of data.rooms) {
      //If there are 2 or more groups in the room with same roundId
      const roundIds = [];
      const eventIds = [];
      for (const groupId of room.currentGroupIds) {
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
      transactions.push(
        this.prisma.room.update({
          where: {
            id: room.id,
          },
          data: {
            currentGroupIds: room.currentGroupIds,
          },
        }),
      );
    }
    await this.prisma.$transaction(transactions);
    await this.socketController.sendServerStatus();
    return {
      message: 'Rooms updated',
    };
  }
}
