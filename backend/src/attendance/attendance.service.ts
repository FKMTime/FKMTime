import { HttpException, Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { CreateAttendaceDto } from './dto/createAttendance.dto';
import { MarkAsPresentDto } from './dto/markAsPresent.dto';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: DbService) {}

  async getAttendanceByGroupId(groupId: string) {
    return this.prisma.attendance.findMany({
      where: {
        groupId,
      },
      include: {
        person: true,
        device: true,
      },
    });
  }

  async getAttendanceByPerson(id: string) {
    return this.prisma.attendance.findMany({
      where: {
        person: {
          id: id,
        },
      },
      include: {
        device: true,
      },
    });
  }

  async markAsPresent(data: MarkAsPresentDto) {
    return this.prisma.attendance.create({
      data: {
        groupId: data.groupId,
        role: data.role,
        person: {
          connect: {
            registrantId: data.registrantId,
          },
        },
      },
    });
  }

  async createAttendance(data: CreateAttendaceDto) {
    const device = await this.prisma.device.findFirst({
      where: {
        espId: data.espId.toString(),
      },
      include: {
        room: true,
      },
    });
    if (!device) {
      throw new HttpException('Device not found', 404);
    }

    const person = await this.prisma.person.findFirst({
      where: {
        cardId: data.cardId.toString(),
      },
    });

    if (!person) {
      throw new HttpException('Person not found', 404);
    }

    const role =
      device.type === 'ATTENDANCE_SCRAMBLER'
        ? 'SCRAMBLER'
        : device.type === 'ATTENDANCE_RUNNER'
          ? 'RUNNER'
          : 'JUDGE';

    return this.prisma.attendance.create({
      data: {
        groupId: device.room.currentGroupId,
        role: role,
        device: {
          connect: {
            id: device.id,
          },
        },
        person: {
          connect: {
            id: person.id,
          },
        },
      },
    });
  }
}
