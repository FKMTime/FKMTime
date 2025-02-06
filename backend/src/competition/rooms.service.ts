import { forwardRef, HttpException, Inject } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import { SocketController } from 'src/socket/socket.controller';

import { UpdateRoomsDto } from './dto/updateCurrentRound.dto';

export class RoomsService {
  constructor(
    @Inject(forwardRef(() => DbService))
    private readonly prisma: DbService,
    private readonly socketController: SocketController,
  ) {}

  async getAllRooms() {
    return this.prisma.room.findMany();
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
