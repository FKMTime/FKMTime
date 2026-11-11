import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, StaffActivityStatus, StaffRole } from '@prisma/client';
import { AppGateway } from 'src/app.gateway';

import { DbService } from '../db/db.service';
import { getTranslation } from '../translations/translations';
import { AddNotAssignedPersonDto } from './dto/addNotAssignedPerson.dto';
import { CreateAttendaceDto } from './dto/createAttendance.dto';
import { MarkReplacedDto } from './dto/markReplaced.dto';
import { RestoreAttendanceDto } from './dto/restoreAttendance.dto';
import { SetNoShowDto } from './dto/setNoShow.dto';
import { UpdateCommentDto } from './dto/updateComment.dto';

/**
 * Tags that can't go with a status, cleared whenever a row moves to it:
 * left early needs them to have done the job, a no-show needs them absent,
 * and nobody replaced someone who did the job themselves.
 */
export const tagsClearedBy = (
  status: StaffActivityStatus,
): Prisma.StaffActivityUncheckedUpdateInput => {
  switch (status) {
    case StaffActivityStatus.PRESENT:
    case StaffActivityStatus.LATE:
      return { noShow: false, replacedById: null };
    case StaffActivityStatus.REPLACED:
      return { leftEarly: false, noShow: false };
    case StaffActivityStatus.ABSENT:
      return { leftEarly: false };
  }
};

const replacedByInclude = { replacedBy: { select: { id: true, name: true } } };

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
        ...replacedByInclude,
      },
    });
  }

  async getRoundStaffing(roundId: string) {
    const runner = await this.prisma.staffActivity.findFirst({
      where: {
        groupId: { startsWith: `${roundId}-g` },
        role: StaffRole.RUNNER,
        isAssigned: true,
      },
      select: { id: true },
    });
    return { hasAssignedRunners: runner !== null };
  }

  async getMostMissedAssignments() {
    const [persons, activities] = await Promise.all([
      this.prisma.person.findMany(),
      this.prisma.staffActivity.findMany(),
    ]);
    const data = persons.map((person) => {
      const own = activities.filter(
        (activity) => activity.personId === person.id,
      );
      const staffing = own.filter(
        (activity) => activity.role !== StaffRole.COMPETITOR,
      );
      const withStatus = (status: StaffActivityStatus) =>
        staffing.filter((activity) => activity.status === status);
      const missedAssignments = withStatus(StaffActivityStatus.ABSENT);
      const lateAssignments = withStatus(StaffActivityStatus.LATE);
      const presentButReplacedAssignments = withStatus(
        StaffActivityStatus.REPLACED,
      );
      const leftEarlyAssignments = staffing.filter(
        (activity) => activity.leftEarly,
      );
      const noShowAssignments = staffing.filter((activity) => activity.noShow);
      const comments = own.filter((activity) => activity.comment !== null);
      return {
        person,
        missedAssignments,
        missedAssignmentsCount: missedAssignments.length,
        lateAssignments,
        lateAssignmentsCount: lateAssignments.length,
        presentButReplacedAssignments,
        presentButReplacedAssignmentsCount:
          presentButReplacedAssignments.length,
        leftEarlyAssignments,
        leftEarlyAssignmentsCount: leftEarlyAssignments.length,
        noShowAssignments,
        noShowAssignmentsCount: noShowAssignments.length,
        comments,
        commentsCount: comments.length,
      };
    });

    return data.sort(
      (a, b) => b.missedAssignmentsCount - a.missedAssignmentsCount,
    );
  }

  async addNotAssignedPerson(groupId: string, data: AddNotAssignedPersonDto) {
    const person = await this.prisma.person.findUnique({
      where: {
        id: data.personId,
      },
    });

    if (!person) {
      throw new HttpException('Person not found', HttpStatus.NOT_FOUND);
    }

    const activityForGroup = await this.prisma.staffActivity.findFirst({
      where: {
        groupId: groupId,
        personId: person.id,
        role: data.role,
        status: StaffActivityStatus.PRESENT,
      },
    });

    if (activityForGroup) {
      throw new HttpException(
        'This person is already marked as present in this group in another role.',
        HttpStatus.CONFLICT,
      );
    }

    const attendance = await this.prisma.staffActivity.upsert({
      where: {
        personId_groupId_role: {
          groupId: groupId,
          personId: person.id,
          role: data.role,
        },
      },
      update: {
        status: StaffActivityStatus.PRESENT,
        ...tagsClearedBy(StaffActivityStatus.PRESENT),
      },
      create: {
        groupId: groupId,
        person: {
          connect: {
            id: person.id,
          },
        },
        role: data.role,
        status: StaffActivityStatus.PRESENT,
        isAssigned: false,
      },
    });

    this.appGateway.handleNewAttendance(groupId, person.id);
    return attendance;
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
        ...replacedByInclude,
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
        ...tagsClearedBy(StaffActivityStatus.PRESENT),
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
        noShow: false,
        replacedBy: { disconnect: true },
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
        retiredAt: null,
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
            noShow: false,
            replacedBy: { disconnect: true },
          },
        });
        // Only after the scan is saved: an open attendance page refetches
        // as soon as it hears this, and would otherwise miss the scan
        this.appGateway.handleNewAttendance(groupId, person.id);
      } catch {
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

  async updateComment(id: string, data: UpdateCommentDto) {
    const attendance = await this.prisma.staffActivity.update({
      where: {
        id: id,
      },
      data: {
        comment: data.comment,
      },
    });
    this.appGateway.handleNewAttendance(
      attendance.groupId,
      attendance.personId,
    );
    return attendance;
  }

  async markAsAbsent(id: string) {
    const attendance = await this.prisma.staffActivity.findUnique({
      where: {
        id: id,
      },
    });
    if (!attendance) {
      throw new HttpException('Attendance not found', HttpStatus.NOT_FOUND);
    }
    if (attendance.isAssigned) {
      await this.prisma.staffActivity.update({
        where: {
          id: id,
        },
        data: {
          status: StaffActivityStatus.ABSENT,
          ...tagsClearedBy(StaffActivityStatus.ABSENT),
        },
      });
    } else {
      await this.prisma.staffActivity.delete({
        where: {
          id: id,
        },
      });
    }
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
        ...tagsClearedBy(StaffActivityStatus.LATE),
      },
    });
    this.appGateway.handleNewAttendance(
      attendance.groupId,
      attendance.personId,
    );
    return attendance;
  }

  async setLeftEarly(id: string, leftEarly: boolean) {
    const activity = await this.findActivity(id);
    const didTheJob: StaffActivityStatus[] = [
      StaffActivityStatus.PRESENT,
      StaffActivityStatus.LATE,
    ];
    if (leftEarly && !didTheJob.includes(activity.status)) {
      throw new HttpException(
        'Only someone who did the job can have left early',
        HttpStatus.CONFLICT,
      );
    }
    const attendance = await this.prisma.staffActivity.update({
      where: { id },
      data: { leftEarly },
    });
    this.appGateway.handleNewAttendance(
      attendance.groupId,
      attendance.personId,
    );
    return attendance;
  }

  /**
   * Someone else did the job. A replacement who isn't present in this group
   * and role yet is added as present, like a walk-in.
   */
  async markAsReplaced(id: string, data: MarkReplacedDto) {
    const activity = await this.findActivity(id);
    if (data.replacedById === activity.personId) {
      throw new HttpException(
        'Nobody can replace themselves',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (data.replacedById) {
      const replacement = await this.prisma.person.findUnique({
        where: { id: data.replacedById },
      });
      if (!replacement) {
        throw new HttpException('Person not found', HttpStatus.NOT_FOUND);
      }
    }
    const status = data.wasPresent
      ? StaffActivityStatus.REPLACED
      : StaffActivityStatus.ABSENT;
    const replacementActivity = data.replacedById
      ? await this.prisma.staffActivity.findUnique({
          where: {
            personId_groupId_role: {
              personId: data.replacedById,
              groupId: activity.groupId,
              role: activity.role,
            },
          },
        })
      : null;
    const [attendance] = await this.prisma.$transaction([
      this.prisma.staffActivity.update({
        where: { id },
        data: {
          status,
          ...tagsClearedBy(status),
          replacedById: data.replacedById ?? null,
        },
      }),
      // A replacement already marked present, or late, stays as recorded
      ...(data.replacedById && !replacementActivity
        ? [
            this.prisma.staffActivity.create({
              data: {
                personId: data.replacedById,
                groupId: activity.groupId,
                role: activity.role,
                status: StaffActivityStatus.PRESENT,
                isAssigned: false,
              },
            }),
          ]
        : []),
      ...(replacementActivity?.status === StaffActivityStatus.ABSENT
        ? [
            this.prisma.staffActivity.update({
              where: { id: replacementActivity.id },
              data: {
                status: StaffActivityStatus.PRESENT,
                ...tagsClearedBy(StaffActivityStatus.PRESENT),
              },
            }),
          ]
        : []),
    ]);
    if (data.replacedById) {
      this.appGateway.handleNewAttendance(activity.groupId, data.replacedById);
    }
    this.appGateway.handleNewAttendance(
      attendance.groupId,
      attendance.personId,
    );
    return attendance;
  }

  /**
   * Not coming for the rest of the day. Only staffing they haven't turned up
   * for is tagged; groups they were at keep their attendance.
   */
  async setNoShow(data: SetNoShowDto) {
    const { count } = await this.prisma.staffActivity.updateMany({
      where: {
        personId: data.personId,
        groupId: { in: data.groupIds },
        role: { not: StaffRole.COMPETITOR },
        status: StaffActivityStatus.ABSENT,
      },
      data: { noShow: data.noShow },
    });
    data.groupIds.forEach((groupId) =>
      this.appGateway.handleNewAttendance(groupId, data.personId),
    );
    return { count };
  }

  /** Puts a row back as it was, for undo */
  async restore(id: string, data: RestoreAttendanceDto) {
    await this.findActivity(id);
    const attendance = await this.prisma.staffActivity.update({
      where: { id },
      data: {
        status: data.status,
        leftEarly: data.leftEarly,
        noShow: data.noShow,
        replacedById: data.replacedById ?? null,
        ...tagsClearedBy(data.status),
      },
    });
    this.appGateway.handleNewAttendance(
      attendance.groupId,
      attendance.personId,
    );
    return attendance;
  }

  private async findActivity(id: string) {
    const activity = await this.prisma.staffActivity.findUnique({
      where: { id },
    });
    if (!activity) {
      throw new HttpException('Attendance not found', HttpStatus.NOT_FOUND);
    }
    return activity;
  }
}
