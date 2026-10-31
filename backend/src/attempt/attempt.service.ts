import { forwardRef, HttpException, Inject, Injectable } from '@nestjs/common';
import {
  Attempt,
  AttemptStatus,
  AttemptType,
  SendingResultsFrequency,
  StaffRole,
} from '@prisma/client';
import { AppGateway } from 'src/app.gateway';
import {
  AttemptEditLogService,
  AttemptSnapshot,
} from 'src/attempt-edit-log/attempt-edit-log.service';
import { AttendanceService } from 'src/attendance/attendance.service';
import { DNS_VALUE, publicPersonSelect } from 'src/constants';
import { isUnofficialEvent } from 'src/events';
import { IncidentService } from 'src/incident/incident.service';
import {
  getAttemptsWaitingForExtra,
  getCountingAttempts,
} from 'src/result/helpers';
import { getNextGroupInRoom } from 'src/wcif-helpers';
import { getRoundInfoFromWcif } from 'wcif-helpers';

import { DbService } from '../db/db.service';
import { ResultService } from '../result/result.service';
import { SocketController } from '../socket/socket.controller';
import { CreateAttemptDto } from './dto/createAttempt.dto';
import { EnterScorecardDto } from './dto/enterScorecard.dto';
import { GiveExtrasDto } from './dto/giveExtras.dto';
import { UpdateAttemptDto } from './dto/updateAttempt.dto';

@Injectable()
export class AttemptService {
  constructor(
    private readonly appGateway: AppGateway,
    private readonly prisma: DbService,
    private readonly attendanceService: AttendanceService,
    private readonly attemptEditLogService: AttemptEditLogService,
    @Inject(forwardRef(() => ResultService))
    private readonly resultService: ResultService,
    @Inject(forwardRef(() => SocketController))
    private readonly socketController: SocketController,
    private readonly incidentService: IncidentService,
  ) {}

  async createAttempt(data: CreateAttemptDto, userId: string) {
    // Validate before getResultOrCreate, so a rejected attempt leaves no empty result behind
    if (data.judgeId && data.judgeId === data.competitorId) {
      throw new HttpException(
        'Judge cannot be the same person as competitor',
        400,
      );
    }

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

    const createdAttempt = await this.prisma.attempt.create({
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
    await this.attemptEditLogService.log(
      createdAttempt as AttemptSnapshot,
      createdAttempt.solvedAt ?? new Date(),
      userId,
      'Manually entered',
    );

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

    if (
      data.type === AttemptType.EXTRA_ATTEMPT &&
      data.status !== AttemptStatus.EXTRA_GIVEN
    ) {
      await this.replaceWaitingAttempt(createdAttempt, userId);
    }
    await this.resultService.settleWaitingExtras(result.id);
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

  /** An extra entered by hand replaces what a station's extra would */
  private async replaceWaitingAttempt(extra: Attempt, userId: string) {
    const attempts = await this.prisma.attempt.findMany({
      where: { resultId: extra.resultId },
    });
    const [waiting] = getAttemptsWaitingForExtra(attempts);
    if (!waiting) return;
    const replaced = await this.prisma.attempt.update({
      where: { id: waiting.id },
      data: { replacedBy: extra.attemptNumber },
    });
    await this.attemptEditLogService.log(
      replaced as AttemptSnapshot,
      new Date(),
      userId,
      `Replaced by extra ${extra.attemptNumber}`,
    );
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

  async reorderAttempts(
    attemptIds: string[],
    resultId: string,
    userId: string,
  ) {
    // Two-pass update to avoid any transient number conflicts
    for (let i = 0; i < attemptIds.length; i++) {
      await this.prisma.attempt.update({
        where: { id: attemptIds[i] },
        data: { attemptNumber: 1000 + i },
      });
    }
    for (let i = 0; i < attemptIds.length; i++) {
      const updated = await this.prisma.attempt.update({
        where: { id: attemptIds[i] },
        data: { attemptNumber: i + 1 },
      });
      await this.attemptEditLogService.log(
        updated as AttemptSnapshot,
        new Date(),
        userId,
        'Reordered',
      );
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
    userId: string,
  ) {
    const attempt = await this.prisma.attempt.findUnique({ where: { id } });
    if (!attempt) throw new HttpException('Attempt not found', 404);

    const newStatus =
      replacedByExtraNumber !== null
        ? AttemptStatus.EXTRA_GIVEN
        : AttemptStatus.STANDARD;

    const updated = await this.prisma.attempt.update({
      where: { id },
      data: { status: newStatus, replacedBy: replacedByExtraNumber },
    });
    await this.attemptEditLogService.log(
      updated as AttemptSnapshot,
      new Date(),
      userId,
      replacedByExtraNumber !== null
        ? 'Replacement set'
        : 'Replacement cleared',
    );
    await this.resultService.settleWaitingExtras(attempt.resultId);

    const result = await this.prisma.result.findUnique({
      where: { id: attempt.resultId },
    });
    await this.resultService.enterWholeScorecardToWcaLiveOrCubingContests(
      result.id,
    );
    this.appGateway.handleAttemptUpdated();
    return { message: 'Replacement updated successfully' };
  }

  async giveExtras(data: GiveExtrasDto, userId: string) {
    const result = await this.getResultForExtras(data.resultId);
    const competition = await this.prisma.competition.findFirst();
    const wcif = JSON.parse(JSON.stringify(competition.wcif));
    if (getRoundInfoFromWcif(result.roundId, wcif)?.format === 'h') {
      throw new HttpException(
        'Extras for all attempts are not available in head-to-head rounds',
        400,
      );
    }
    const countingIds = getCountingAttempts(result.attempts).map((a) => a.id);
    if (data.attemptIds.some((id) => !countingIds.includes(id))) {
      throw new HttpException('These attempts cannot be replaced', 400);
    }
    const attempts = result.attempts.filter((attempt) =>
      data.attemptIds.includes(attempt.id),
    );

    const replaced = await this.prisma.$transaction(async (tx) => {
      const grant = await tx.extraGrant.create({
        data: {
          useFreshSet: data.useFreshSet,
          result: { connect: { id: result.id } },
          createdBy: { connect: { id: userId } },
        },
      });
      await tx.result.update({
        where: { id: result.id },
        data: this.doubleCheckCleared,
      });
      return Promise.all(
        attempts.map((attempt) =>
          tx.attempt.update({
            where: { id: attempt.id },
            data: {
              status: AttemptStatus.EXTRA_GIVEN,
              replacedBy: null,
              comment: data.comment,
              statusBeforeGrant: attempt.status,
              extraGrant: { connect: { id: grant.id } },
              updatedBy: { connect: { id: userId } },
            },
          }),
        ),
      );
    });
    await this.logAll(replaced, userId, 'Extras given for all attempts');

    if (data.removeFromLive) {
      await this.sendScorecardUnlessNever(result.id, competition);
    }
    this.appGateway.handleAttemptUpdated();
    return { replaced: replaced.length };
  }

  async restoreExtraGrant(grantId: string, userId: string) {
    const grant = await this.prisma.extraGrant.findUnique({
      where: { id: grantId },
      include: { attempts: true },
    });
    if (!grant) throw new HttpException('Extra grant not found', 404);
    await this.getResultForExtras(grant.resultId);
    const latestGrant = await this.getRestorableGrant(grant.resultId);
    if (latestGrant?.id !== grant.id) {
      throw new HttpException('Only the latest grant can be restored', 409);
    }

    const restored = await this.prisma.$transaction(async (tx) => {
      await tx.extraGrant.update({
        where: { id: grant.id },
        data: { restoredAt: new Date() },
      });
      await tx.result.update({
        where: { id: grant.resultId },
        data: this.doubleCheckCleared,
      });
      return Promise.all(
        grant.attempts.map((attempt) =>
          tx.attempt.update({
            where: { id: attempt.id },
            data: {
              status: attempt.statusBeforeGrant,
              replacedBy: null,
              statusBeforeGrant: null,
              extraGrant: { disconnect: true },
              updatedBy: { connect: { id: userId } },
            },
          }),
        ),
      );
    });
    await this.logAll(restored, userId, 'Original attempt restored');

    const competition = await this.prisma.competition.findFirst();
    await this.sendScorecardUnlessNever(grant.resultId, competition);
    this.appGateway.handleAttemptUpdated();
    return { restored: restored.length };
  }

  /** What the delegate needs to know before giving extras for a result */
  async getExtrasContext(resultId: string) {
    const result = await this.prisma.result.findUnique({
      where: { id: resultId },
    });
    if (!result) throw new HttpException('Result not found', 404);
    const competition = await this.prisma.competition.findFirst();
    const wcif = JSON.parse(JSON.stringify(competition.wcif));
    const rooms = await this.prisma.room.findMany();
    const hasNextGroup = rooms.some((room) =>
      room.currentGroupIds.some(
        (groupId) =>
          groupId.split('-g')[0] === result.roundId &&
          getNextGroupInRoom(groupId, room.name, wcif),
      ),
    );
    const [eventId, roundNumber] = result.roundId.split('-r');
    const nextRoundAttempts = await this.prisma.attempt.count({
      where: { result: { roundId: `${eventId}-r${+roundNumber + 1}` } },
    });
    const grant = await this.getRestorableGrant(resultId);
    return {
      hasNextGroup,
      nextRoundStarted: nextRoundAttempts > 0,
      restorableGrantId: grant?.id ?? null,
      restorableAttemptIds: grant?.attempts.map((a) => a.id) ?? [],
    };
  }

  private doubleCheckCleared = {
    isDoubleChecked: false,
    doubleCheckedAt: null,
    doubleCheckedBy: { disconnect: true },
  };

  private async getResultForExtras(resultId: string) {
    const result = await this.prisma.result.findUnique({
      where: { id: resultId },
      include: { attempts: true },
    });
    if (!result) throw new HttpException('Result not found', 404);
    if (result.attempts.some((a) => a.status === AttemptStatus.UNRESOLVED)) {
      throw new HttpException('Resolve the open incident first', 409);
    }
    return result;
  }

  private getRestorableGrant(resultId: string) {
    return this.prisma.extraGrant.findFirst({
      where: { resultId, restoredAt: null },
      orderBy: { createdAt: 'desc' },
      include: { attempts: { select: { id: true } } },
    });
  }

  private async logAll(attempts: unknown[], userId: string, comment: string) {
    const now = new Date();
    for (const attempt of attempts) {
      await this.attemptEditLogService.log(
        attempt as AttemptSnapshot,
        now,
        userId,
        comment,
      );
    }
  }

  private async sendScorecardUnlessNever(
    resultId: string,
    competition: { sendingResultsFrequency: SendingResultsFrequency },
  ) {
    if (competition.sendingResultsFrequency === SendingResultsFrequency.NEVER) {
      return;
    }
    try {
      await this.resultService.enterWholeScorecardToWcaLiveOrCubingContests(
        resultId,
      );
    } catch (e) {
      console.error(e);
    }
  }

  async swapAttempts(
    attemptId: string,
    secondAttemptId: string,
    userId: string,
  ) {
    const firstAttempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
    });
    const secondAttempt = await this.prisma.attempt.findUnique({
      where: { id: secondAttemptId },
    });

    const updatedFirst = await this.prisma.attempt.update({
      where: { id: attemptId },
      data: { attemptNumber: secondAttempt.attemptNumber },
    });
    const updatedSecond = await this.prisma.attempt.update({
      where: { id: secondAttemptId },
      data: { attemptNumber: firstAttempt.attemptNumber },
    });
    const now = new Date();
    await this.attemptEditLogService.log(
      updatedFirst as AttemptSnapshot,
      now,
      userId,
      `Swapped with attempt ${firstAttempt.attemptNumber}`,
    );
    await this.attemptEditLogService.log(
      updatedSecond as AttemptSnapshot,
      now,
      userId,
      `Swapped with attempt ${secondAttempt.attemptNumber}`,
    );
    return {
      message: 'Attempts swapped successfully',
    };
  }

  async updateAttempt(id: string, data: UpdateAttemptDto, userId: string) {
    const attemptToUpdate = await this.prisma.attempt.findUnique({
      where: { id: id },
      include: { result: { select: { personId: true } } },
    });
    if (!attemptToUpdate) {
      throw new HttpException('Attempt not found', 404);
    }

    if (data.judgeId && data.judgeId === attemptToUpdate.result?.personId) {
      throw new HttpException(
        'Judge cannot be the same person as competitor',
        400,
      );
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
    await this.attemptEditLogService.log(
      attempt as AttemptSnapshot,
      new Date(),
      userId,
      'Updated',
    );
    if (data.updateReplacedBy) {
      const attemptToReplace = await this.prisma.attempt.findFirst({
        where: {
          resultId: attempt.resultId,
          status: AttemptStatus.EXTRA_GIVEN,
          replacedBy: null,
        },
        orderBy: { attemptNumber: 'asc' },
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
    await this.resultService.settleWaitingExtras(attempt.resultId);
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
      // Only an attempt entered on a station has one waiting for the answer
      if (attempt.device) {
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

    if (attempt.status === AttemptStatus.UNRESOLVED && attempt.device) {
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
        // Only what counts for the result: not scrambled-only (no time yet),
        // waiting on an incident, or replaced by an extra
        status: { in: [AttemptStatus.STANDARD, AttemptStatus.RESOLVED] },
        // A DNS was never solved, so it isn't a recent result
        penalty: { not: DNS_VALUE },
        solvedAt: { not: null },
      },
      orderBy: { solvedAt: 'desc' },
      take: 5,
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

  async getAttemptEditLog(id: string) {
    return this.attemptEditLogService.getLogForAttempt(id);
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
