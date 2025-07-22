import { Injectable } from '@nestjs/common';
import { StaffActivityStatus, StaffRole } from '@prisma/client';
import { AppGateway } from 'src/app.gateway';

import { DbService } from '../db/db.service';
import { getTranslation } from '../translations/translations';
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

  async getMostMissedAssignments() {
    const persons = await this.prisma.person.findMany();
    const data = [];
    for (const person of persons) {
      const lateAssignments = await this.prisma.staffActivity.findMany({
        where: {
          status: StaffActivityStatus.LATE,
          role: {
            not: StaffRole.COMPETITOR,
          },
          personId: person.id,
        },
      });
      const presentButReplacedAssignments =
        await this.prisma.staffActivity.findMany({
          where: {
            status: StaffActivityStatus.REPLACED,
            role: {
              not: StaffRole.COMPETITOR,
            },
            personId: person.id,
          },
        });
      const missedAssignments = await this.prisma.staffActivity.findMany({
        where: {
          status: StaffActivityStatus.ABSENT,
          role: {
            not: StaffRole.COMPETITOR,
          },
          personId: person.id,
        },
      });
      data.push({
        person,
        missedAssignments: missedAssignments,
        missedAssignmentsCount: missedAssignments.length,
        lateAssignments: lateAssignments,
        lateAssignmentsCount: lateAssignments.length,
        presentButReplacedAssignments: presentButReplacedAssignments,
        presentButReplacedAssignmentsCount:
          presentButReplacedAssignments.length,
      });
    }

    return data.sort(
      (a, b) => b.missedAssignmentsCount - a.missedAssignmentsCount,
    );
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
        status: StaffActivityStatus.PRESENT,
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
    deviceId?: string,
  ) {
    await this.prisma.staffActivity.upsert({
      where: {
        personId_groupId_role: {
          groupId: groupId,
          personId: competitorId,
          role: StaffRole.COMPETITOR,
        },
      },
      update: {
        device: deviceId
          ? {
              connect: {
                id: deviceId,
              },
            }
          : undefined,
        status: StaffActivityStatus.PRESENT,
      },
      create: {
        groupId: groupId,
        person: {
          connect: {
            id: competitorId,
          },
        },
        device: deviceId
          ? {
              connect: {
                id: deviceId,
              },
            }
          : undefined,
        role: StaffRole.COMPETITOR,
        status: StaffActivityStatus.PRESENT,
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
        status: StaffActivityStatus.PRESENT,
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
        status: StaffActivityStatus.PRESENT,
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
            activity.status === StaffActivityStatus.PRESENT &&
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
            status: StaffActivityStatus.PRESENT,
          },
          update: {
            device: {
              connect: {
                id: device.id,
              },
            },
            status: StaffActivityStatus.PRESENT,
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
        status: StaffActivityStatus.ABSENT,
      },
    });
    this.appGateway.handleNewAttendance(
      attendance.groupId,
      attendance.personId,
    );
    return attendance;
  }

  async markAsLate(id: string) {
    const attendance = await this.prisma.staffActivity.update({
      where: {
        id: id,
      },
      data: {
        status: StaffActivityStatus.LATE,
      },
    });
    this.appGateway.handleNewAttendance(
      attendance.groupId,
      attendance.personId,
    );
    return attendance;
  }

  async markAsPresentButReplaced(id: string) {
    const attendance = await this.prisma.staffActivity.update({
      where: {
        id: id,
      },
      data: {
        status: StaffActivityStatus.REPLACED,
      },
    });
    this.appGateway.handleNewAttendance(
      attendance.groupId,
      attendance.personId,
    );
    return attendance;
  }
}
