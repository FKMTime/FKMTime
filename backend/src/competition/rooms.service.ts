import { Inject, forwardRef } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import { UpdateRoomsDto } from './dto/updateCurrentRound.dto';
import { SocketController } from 'src/socket/socket.controller';

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
      transactions.push(
        this.prisma.room.update({
          where: {
            id: room.id,
          },
          data: {
            currentGroupId: room.currentGroupId,
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
