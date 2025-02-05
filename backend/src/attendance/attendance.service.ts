import { Injectable } from '@nestjs/common';
import { AppGateway } from 'src/app.gateway';

import { DbService } from '../db/db.service';
import { getTranslation } from '../translations';
import { CreateAttendaceDto } from './dto/createAttendance.dto';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: DbService,
    private readonly appGateway: AppGateway,
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
    this.appGateway.handleNewAttendance(
      attendance.groupId,
      attendance.personId,
    );
    return attendance;
  }

  async markCompetitorAsPresent(
    competitorId: string,
    groupId: string,
    deviceId: string,
  ) {
    await this.prisma.staffActivity.upsert({
      where: {
        personId_groupId_role: {
          groupId: groupId,
          personId: competitorId,
          role: 'COMPETITOR',
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
            id: competitorId,
          },
        },
        device: {
          connect: {
            id: deviceId,
          },
        },
        role: 'COMPETITOR',
        isPresent: true,
        isAssigned: false,
      },
    });
    this.appGateway.handleNewAttendance(groupId, competitorId);
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
    this.appGateway.handleNewAttendance(groupId, judgeId);
  }

  async getAttendanceStatistics() {
    const persons = await this.prisma.person.findMany({
      where: {
        registrantId: {
          not: null,
        },
      },
      include: {
        StaffActivity: true,
      },
    });
    const roundsThatTookPlace = await this.prisma.result.findMany({
      distinct: ['roundId'],
    });

    return persons.map((person) => {
      const totalPresentAtStaffingComparedToRounds =
        person.StaffActivity.filter(
          (activity) =>
            activity.isPresent &&
            activity.role !== 'COMPETITOR' &&
            roundsThatTookPlace.some(
              (round) => round.roundId === activity.groupId.split('-g')[0],
            ),
        ).length;
      const totalStaffingComparedToRounds = person.StaffActivity.filter(
        (activity) =>
          activity.isAssigned &&
          activity.role !== 'COMPETITOR' &&
          roundsThatTookPlace.some(
            (round) => round.roundId === activity.groupId.split('-g')[0],
          ),
      ).length;
      return {
        personName: person.name,
        totalAssignedStaffing: person.StaffActivity.filter(
          (activity) => activity.isAssigned && activity.role !== 'COMPETITOR',
        ).length,
        presentPercentage:
          (totalPresentAtStaffingComparedToRounds /
            totalStaffingComparedToRounds) *
            100 || 0,
        totalPresentAtStaffingComparedToRounds,
        totalStaffingComparedToRounds,
      };
    });
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

    //QUICK FIX
    if (!device) {
      return {
        message: getTranslation('attendanceConfirmed', 'PL'),
      };
    }

    const person = await this.prisma.person.findFirst({
      where: {
        cardId: data.cardId.toString(),
      },
    });

    if (!person) {
      return {
        message: getTranslation('attendanceConfirmed', 'PL'),
      };
    }

    const role =
      device.type === 'ATTENDANCE_SCRAMBLER'
        ? 'SCRAMBLER'
        : device.type === 'ATTENDANCE_RUNNER'
          ? 'RUNNER'
          : 'JUDGE';
    for (const groupId of device.room.currentGroupIds) {
      this.appGateway.handleNewAttendance(groupId, person.id);
      try {
        await this.prisma.staffActivity.upsert({
          where: {
            personId_groupId_role: {
              groupId: groupId,
              personId: person.id,
              role: role,
            },
          },
          create: {
            groupId: groupId,
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
        return {
          message: getTranslation('attendanceConfirmed', person.countryIso2),
        };
        // if (e instanceof PrismaClientKnownRequestError) {
        //   if (e.code === 'P2002') {
        //     throw new HttpException(
        //       {
        //         message: getTranslation('alreadyCheckedIn', person.countryIso2),
        //       },
        //       409,
        //     );
        //   }
        // }
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
    this.appGateway.handleNewAttendance(
      attendance.groupId,
      attendance.personId,
    );
    return attendance;
  }
}
