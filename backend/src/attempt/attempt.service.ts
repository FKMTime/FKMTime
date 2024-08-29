import { HttpException, Inject, Injectable, forwardRef } from '@nestjs/common';
import { AttemptStatus, StaffRole } from '@prisma/client';
import { DbService } from '../db/db.service';
import { ResultService } from '../result/result.service';
import { SocketController } from '../socket/socket.controller';
import { WcaService } from '../wca/wca.service';
import { CreateAttemptDto } from './dto/createAttempt.dto';
import { UpdateAttemptDto } from './dto/updateAttempt.dto';
import { isUnofficialEvent } from 'src/events';
import { ContestsService } from 'src/contests/contests.service';
import { AttendanceService } from 'src/attendance/attendance.service';
import { AppGateway } from 'src/app.gateway';

@Injectable()
export class AttemptService {
  constructor(
    private readonly appGateway: AppGateway,
    private readonly prisma: DbService,
    private readonly wcaService: WcaService,
    private readonly contestsService: ContestsService,
    private readonly attendanceService: AttendanceService,
    @Inject(forwardRef(() => ResultService))
    private readonly resultService: ResultService,
    @Inject(forwardRef(() => SocketController))
    private readonly socketController: SocketController,
  ) {}

  async createAttempt(data: CreateAttemptDto) {
    const result = await this.resultService.getResultOrCreate(
      data.competitorId,
      data.roundId,
    );

    await this.prisma.attempt.create({
      data: {
        attemptNumber: data.attemptNumber,
        value: data.value,
        penalty: data.penalty,
        solvedAt: new Date(),
        device: {
          connect: {
            id: data.deviceId,
          },
        },
        judge: data.judgeId
          ? {
              connect: {
                id: data.judgeId,
              },
            }
          : undefined,
        replacedBy: data.replacedBy ? data.replacedBy : null,
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
      data.deviceId,
    );

    if (data.submitToWcaLive) {
      if (isUnofficialEvent(data.roundId.split('-')[0])) {
        await this.contestsService.enterWholeScorecardToCubingContests(result);
      } else {
        await this.wcaService.enterWholeScorecardToWcaLive(result);
      }
    }
    return {
      message: 'Attempt created successfully',
    };
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
      this.socketController.sendResponseToAllSockets({
        type: 'IncidentResolved',
        data: {
          attempt: attempt,
          espId: attempt.device.espId,
          shouldScanCards: attempt.status === AttemptStatus.RESOLVED,
        },
      });
    }
    if (!attempt) {
      throw new HttpException('Attempt not found', 404);
    }
    if (data.submitToWcaLive) {
      const result = await this.resultService.getResultOrCreate(
        attempt.result.person.id,
        attempt.result.roundId,
      );
      try {
        await this.wcaService.enterWholeScorecardToWcaLive(result);
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
    return this.prisma.attempt.delete({
      where: { id: id },
    });
  }

  async getAttemptById(id: string) {
    return this.prisma.attempt.findUnique({
      where: { id },
      include: {
        judge: {
          select: {
            id: true,
            name: true,
            wcaId: true,
            registrantId: true,
          },
        },
        device: true,
        result: {
          include: {
            person: {
              select: {
                id: true,
                name: true,
                wcaId: true,
                registrantId: true,
              },
            },
          },
        },
      },
    });
  }

  async getUnresolvedAttempts() {
    return this.prisma.attempt.findMany({
      where: { status: AttemptStatus.UNRESOLVED },
      include: {
        judge: {
          select: {
            id: true,
            name: true,
            wcaId: true,
            registrantId: true,
          },
        },
        device: true,
        result: {
          include: {
            person: {
              select: {
                id: true,
                name: true,
                wcaId: true,
                registrantId: true,
              },
            },
          },
        },
      },
    });
  }

  async getIncidents(search?: string) {
    const whereParams = {};
    if (search) {
      whereParams['result'] = {
        person: {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
      };
    }
    return this.prisma.attempt.findMany({
      where: {
        ...whereParams,
        status: {
          in: [AttemptStatus.RESOLVED, AttemptStatus.EXTRA_GIVEN],
        },
      },
      orderBy: {
        solvedAt: 'desc',
      },
      include: {
        judge: {
          select: {
            id: true,
            name: true,
            wcaId: true,
            registrantId: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
        device: true,
        result: {
          include: {
            person: {
              select: {
                id: true,
                name: true,
                wcaId: true,
                registrantId: true,
              },
            },
          },
        },
      },
    });
  }
}
