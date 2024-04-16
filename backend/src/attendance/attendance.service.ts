import { HttpException, Injectable } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { DbService } from '../db/db.service';
import { getTranslation } from '../translations';
import { AttendanceGateway } from './attendance.gateway';
import { CreateAttendaceDto } from './dto/createAttendance.dto';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: DbService,
    private readonly attendanceGateway: AttendanceGateway,
  ) {}

  async getAttendanceByGroupId(groupId: string) {
    return this.prisma.staffActivity.findMany({
      where: {
        groupId,
      },
      include: {
        person: true,
        device: true,
      },
    });
  }

  async getStaffActivitiesByPersonId(id: string) {
    return this.prisma.staffActivity.findMany({
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

  async markAsPresent(id: string) {
    const attendance = await this.prisma.staffActivity.update({
      where: {
        id,
      },
      data: {
        isPresent: true,
      },
    });
    this.attendanceGateway.handleNewAttendance(
      attendance.groupId,
      attendance.personId,
    );
    return attendance;
  }

  async markJudgeAsPresent(judgeId: string, groupId: string, deviceId: string) {
    await this.prisma.staffActivity.upsert({
      where: {
        personId_groupId_role: {
          groupId: groupId,
          personId: judgeId,
          role: 'JUDGE',
        },
      },
      update: {
        device: {
          connect: {
            id: deviceId,
          },
        },
        isPresent: true,
      },
      create: {
        groupId: groupId,
        person: {
          connect: {
            id: judgeId,
          },
        },
        device: {
          connect: {
            id: deviceId,
          },
        },
        role: 'JUDGE',
        isPresent: true,
        isAssigned: false,
      },
    });
    this.attendanceGateway.handleNewAttendance(groupId, judgeId);
  }

  async createAttendance(data: CreateAttendaceDto) {
    const device = await this.prisma.device.findFirst({
      where: {
        espId: data.espId,
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
    this.attendanceGateway.handleNewAttendance(
      device.room.currentGroupId,
      person.id,
    );
    try {
      await this.prisma.staffActivity.upsert({
        where: {
          personId_groupId_role: {
            groupId: device.room.currentGroupId,
            personId: person.id,
            role: role,
          },
        },
        create: {
          groupId: device.room.currentGroupId,
          role: role,
          person: {
            connect: {
              id: person.id,
            },
          },
          device: {
            connect: {
              id: device.id,
            },
          },
          isAssigned: false,
          isPresent: true,
        },
        update: {
          device: {
            connect: {
              id: device.id,
            },
          },
          isPresent: true,
        },
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
          throw new HttpException(
            {
              message: getTranslation('alreadyCheckedIn', person.countryIso2),
            },
            409,
          );
        }
      }
    }
    return {
      message: getTranslation('attendanceConfirmed', person.countryIso2),
    };
  }

  async markAsAbsent(id: string) {
    const attendance = await this.prisma.staffActivity.update({
      where: {
        id: id,
      },
      data: {
        isPresent: false,
      },
    });
    this.attendanceGateway.handleNewAttendance(
      attendance.groupId,
      attendance.personId,
    );
    return attendance;
  }
}
