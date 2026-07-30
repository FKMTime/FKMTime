import { forwardRef, HttpException, Inject, Injectable } from '@nestjs/common';
import { AttemptStatus, StaffRole } from '@prisma/client';
import { AppGateway } from 'src/app.gateway';
import { AttendanceService } from 'src/attendance/attendance.service';
import { publicPersonSelect } from 'src/constants';
import { isUnofficialEvent } from 'src/events';
import { IncidentService } from 'src/incident/incident.service';

import { DbService } from '../db/db.service';
import { ResultService } from '../result/result.service';
import { SocketController } from '../socket/socket.controller';
import { CreateAttemptDto } from './dto/createAttempt.dto';
import { EnterScorecardDto } from './dto/enterScorecard.dto';
import { UpdateAttemptDto } from './dto/updateAttempt.dto';

@Injectable()
export class AttemptService {
  constructor(
    private readonly appGateway: AppGateway,
    private readonly prisma: DbService,
    private readonly attendanceService: AttendanceService,
    @Inject(forwardRef(() => ResultService))
    private readonly resultService: ResultService,
    @Inject(forwardRef(() => SocketController))
    private readonly socketController: SocketController,
    private readonly incidentService: IncidentService,
  ) {}

  async createAttempt(data: CreateAttemptDto, userId: string) {
    const result = await this.resultService.getResultOrCreate(
      data.competitorId,
      data.roundId,
    );

    const duplicate = await this.prisma.attempt.findFirst({
      where: {
        resultId: result.id,
        attemptNumber: data.attemptNumber,
        type: data.type,
      },
    });
    if (duplicate) {
      throw new HttpException(
        'Attempt with this number and type already exists',
        409,
      );
    }

    await this.prisma.attempt.create({
      data: {
        attemptNumber: data.attemptNumber,
        value: data.value,
        penalty: data.penalty,
        solvedAt: new Date(),
        device: data.deviceId
          ? {
              connect: {
                id: data.deviceId,
              },
            }
          : undefined,
        judge: data.judgeId
          ? {
              connect: {
                id: data.judgeId,
              },
            }
          : undefined,
        scrambler: data.scramblerId
          ? {
              connect: {
                id: data.scramblerId,
              },
            }
          : undefined,
        replacedBy: data.replacedBy ? data.replacedBy : null,
        updatedBy: {
          connect: {
            id: userId,
          },
        },
        status: data.status,
        type: data.type,
        comment: data.comment,
        result: {
          connect: {
            id: result.id,
          },
        },
      },
    });

    const staffActivity = await this.prisma.staffActivity.findFirst({
      where: {
        personId: data.competitorId,
        groupId: {
          contains: data.roundId,
        },
        role: StaffRole.COMPETITOR,
      },
    });
    const groupId = isUnofficialEvent(data.roundId.split('-')[0])
      ? `${data.roundId}-g1`
      : staffActivity
        ? staffActivity.groupId
        : `${data.roundId}-g1`;

    await this.attendanceService.markCompetitorAsPresent(
      result.person.id,
      groupId,
      data.deviceId ? data.deviceId : '',
    );

    if (data.status !== AttemptStatus.EXTRA_GIVEN) {
      await this.resultService.enterWholeScorecardToWcaLiveOrCubingContests(
        result.id,
      );
    }
    this.appGateway.handleResultEntered(result.roundId);
    return {
      message: 'Attempt created successfully',
    };
  }

  async enterScorecard(data: EnterScorecardDto, userId: string) {
    for (const attempt of data.attempts) {
      await this.updateAttempt(attempt.id, attempt, userId);
    }
    for (const attempt of data.newAttempts) {
      await this.createAttempt(attempt, userId);
    }
    return {
      message: 'Scorecard entered successfully',
    };
  }

  async reorderAttempts(attemptIds: string[], resultId: string) {
    // Two-pass update to avoid any transient number conflicts
    for (let i = 0; i < attemptIds.length; i++) {
      await this.prisma.attempt.update({
        where: { id: attemptIds[i] },
        data: { attemptNumber: 1000 + i },
      });
    }
    for (let i = 0; i < attemptIds.length; i++) {
      await this.prisma.attempt.update({
        where: { id: attemptIds[i] },
        data: { attemptNumber: i + 1 },
      });
    }
    await this.resultService.enterWholeScorecardToWcaLiveOrCubingContests(
      resultId,
    );
    this.appGateway.handleAttemptUpdated();
    return { message: 'Attempts reordered successfully' };
  }

  async setAttemptReplacement(
    id: string,
    replacedByExtraNumber: number | null,
  ) {
    const attempt = await this.prisma.attempt.findUnique({ where: { id } });
    if (!attempt) throw new HttpException('Attempt not found', 404);

    const newStatus =
      replacedByExtraNumber !== null
        ? AttemptStatus.EXTRA_GIVEN
        : AttemptStatus.STANDARD;

    await this.prisma.attempt.update({
      where: { id },
      data: { status: newStatus, replacedBy: replacedByExtraNumber },
    });

    const result = await this.prisma.result.findUnique({
      where: { id: attempt.resultId },
    });
    await this.resultService.enterWholeScorecardToWcaLiveOrCubingContests(
      result.id,
    );
    this.appGateway.handleAttemptUpdated();
    return { message: 'Replacement updated successfully' };
  }

  async swapAttempts(attemptId: string, secondAttemptId: string) {
    const firstAttempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
    });
    const secondAttempt = await this.prisma.attempt.findUnique({
      where: { id: secondAttemptId },
    });

    await this.prisma.attempt.update({
      where: { id: attemptId },
      data: {
        attemptNumber: secondAttempt.attemptNumber,
      },
    });
    await this.prisma.attempt.update({
      where: { id: secondAttemptId },
      data: {
        attemptNumber: firstAttempt.attemptNumber,
      },
    });
    return {
      message: 'Attempts swapped successfully',
    };
  }

  async updateAttempt(id: string, data: UpdateAttemptDto, userId: string) {
    const attemptToUpdate = await this.prisma.attempt.findUnique({
      where: { id: id },
    });
    if (!attemptToUpdate) {
      throw new HttpException('Attempt not found', 404);
    }

    const duplicate = await this.prisma.attempt.findFirst({
      where: {
        resultId: attemptToUpdate.resultId,
        attemptNumber: data.attemptNumber,
        type: data.type,
        NOT: { id: id },
      },
    });
    if (duplicate) {
      throw new HttpException(
        'Attempt with this number and type already exists',
        409,
      );
    }

    if (data.status !== AttemptStatus.EXTRA_GIVEN || data.replacedBy === 0) {
      data.replacedBy = null;
    }
    const dataToUpdate = {
      attemptNumber: data.attemptNumber,
      replacedBy: data.replacedBy,
      penalty: data.penalty,
      status: data.status,
      type: data.type,
      value: data.value,
      comment: data.comment,
    };

    const attempt = await this.prisma.attempt.update({
      where: { id: id },
      data: {
        ...dataToUpdate,
        judge: data.judgeId ? { connect: { id: data.judgeId } } : undefined,
        device: data.deviceId ? { connect: { id: data.deviceId } } : undefined,
        updatedBy: { connect: { id: userId } },
      },
      include: {
        device: true,
        result: {
          include: {
            person: true,
          },
        },
      },
    });
    if (data.updateReplacedBy) {
      const attemptToReplace = await this.prisma.attempt.findFirst({
        where: {
          status: AttemptStatus.EXTRA_GIVEN,
          replacedBy: null,
        },
        select: {
          id: true,
        },
      });
      if (attemptToReplace) {
        await this.prisma.attempt.update({
          where: { id: attemptToReplace.id },
          data: {
            replacedBy: attempt.attemptNumber,
          },
        });
      }
    }
    this.appGateway.handleAttemptUpdated();
    if (
      attemptToUpdate.status === AttemptStatus.UNRESOLVED &&
      attempt.status !== AttemptStatus.UNRESOLVED
    ) {
      if (data.noteworthy) {
        await this.incidentService.addAttemptAsNoteworthyIncident(
          attempt.id,
          userId,
        );
      }
      this.socketController.sendResponseToAllSockets({
        type: 'IncidentResolved',
        data: {
          attempt: attempt,
          espId: attempt.device.espId,
          shouldScanCards: data.doNotRequireCards
            ? false
            : attempt.status === AttemptStatus.RESOLVED,
        },
      });
    }
    if (!attempt) {
      throw new HttpException('Attempt not found', 404);
    }
    if (data.status !== AttemptStatus.EXTRA_GIVEN) {
      const result = await this.resultService.getResultOrCreate(
        attempt.result.person.id,
        attempt.result.roundId,
      );
      try {
        await this.resultService.enterWholeScorecardToWcaLiveOrCubingContests(
          result.id,
        );
      } catch (e) {
        console.error(e);
      }
      return attempt;
    }
  }

  async deleteAttempt(id: string) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id },
      include: {
        device: true,
      },
    });
    if (!attempt) {
      throw new HttpException('Attempt not found', 404);
    }

    if (attempt.status === AttemptStatus.UNRESOLVED) {
      this.socketController.sendResponseToAllSockets({
        type: 'IncidentResolved',
        data: {
          attempt: attempt,
          espId: attempt.device.espId,
          shouldScanCards: false,
        },
      });
    }
    await this.prisma.attempt.delete({
      where: { id: id },
    });
    await this.resultService.enterWholeScorecardToWcaLiveOrCubingContests(
      attempt.resultId,
    );

    const allAttempts = await this.prisma.attempt.count({
      where: {
        resultId: attempt.resultId,
      },
    });
    if (allAttempts === 0) {
      await this.prisma.result.delete({
        where: { id: attempt.resultId },
      });
      return {
        resultDeleted: true,
      };
    }
    this.appGateway.handleAttemptUpdated();
    return {
      resultDeleted: false,
      message: 'Attempt deleted successfully',
    };
  }

  async getRecentAttemptsByRoundId(roundId: string) {
    return this.prisma.attempt.findMany({
      where: {
        result: { roundId },
      },
      orderBy: { solvedAt: 'desc' },
      take: 3,
      include: {
        result: {
          select: {
            id: true,
            person: publicPersonSelect,
          },
        },
      },
    });
  }

  async getAttemptById(id: string) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id },
      include: {
        judge: publicPersonSelect,
        scrambler: publicPersonSelect,
        device: true,
        result: {
          include: {
            person: publicPersonSelect,
          },
        },
      },
    });
    const previousIncidents = await this.prisma.attempt.findMany({
      where: {
        result: {
          personId: attempt.result.person.id,
        },
        status: {
          in: [AttemptStatus.RESOLVED, AttemptStatus.EXTRA_GIVEN],
        },
      },
      orderBy: {
        solvedAt: 'desc',
      },
      include: {
        judge: publicPersonSelect,
        device: true,
        result: {
          include: {
            person: publicPersonSelect,
          },
        },
      },
    });
    return {
      attempt,
      previousIncidents,
    };
  }
}
