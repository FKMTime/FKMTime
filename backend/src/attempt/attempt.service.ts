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
import { DNF_VALUE, DNS_VALUE, publicPersonSelect } from 'src/constants';
import { getMaxPenalty, isUnofficialEvent } from 'src/events';
import { IncidentService } from 'src/incident/incident.service';
import {
  checkCutoff,
  getAttemptsWaitingForExtra,
  getCountingAttempts,
  getSortedStandardAttempts,
  sortByPosition,
} from 'src/result/helpers';
import { getNextGroupInRoom } from 'src/wcif-helpers';
import {
  Competition,
  getNumberOfAttemptsForRound,
  getRoundInfoFromWcif,
} from 'wcif-helpers';

import { DbService } from '../db/db.service';
import { ResultService } from '../result/result.service';
import { SocketController } from '../socket/socket.controller';
import {
  DNF_RULING_UNDONE,
  getStateBeforeRuling,
  REMAINING_RULED_DNF,
  RULED_DNF,
} from './dnfRuling';
import { CreateAttemptDto } from './dto/createAttempt.dto';
import { DnfAttemptsDto } from './dto/dnfAttempts.dto';
import { EnterScorecardDto } from './dto/enterScorecard.dto';
import { GiveExtrasDto } from './dto/giveExtras.dto';
import { UpdateAttemptDto } from './dto/updateAttempt.dto';

/** Has a time of its own, so a DNF ruling can change it */
const isSolve = (attempt: Pick<Attempt, 'penalty'>) =>
  attempt.penalty !== DNF_VALUE && attempt.penalty !== DNS_VALUE;

const assertPenaltyAllowed = (penalty: number, roundId: string) => {
  const maxPenalty = getMaxPenalty(roundId.split('-r')[0]);
  if (penalty > maxPenalty) {
    throw new HttpException(
      `The penalty can be at most +${maxPenalty} in this event`,
      400,
    );
  }
};

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
    assertPenaltyAllowed(data.penalty, data.roundId);

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
    await this.setReplacedBy(waiting.id, extra.attemptNumber, userId);
    if (waiting.extraGrantId) {
      await this.keepExtrasInOrder(waiting.extraGrantId, attempts, userId);
    }
  }

  /** Extras typed in out of order still go to their attempts in order */
  private async keepExtrasInOrder(
    grantId: string,
    attempts: Attempt[],
    userId: string,
  ) {
    const updated = await this.prisma.attempt.findMany({
      where: { resultId: attempts[0].resultId },
    });
    const replaced = sortByPosition(
      updated.filter((a) => a.extraGrantId === grantId && a.replacedBy),
      updated,
    );
    const extraNumbers = replaced
      .map((attempt) => attempt.replacedBy)
      .sort((a, b) => a - b);
    for (const [index, attempt] of replaced.entries()) {
      if (attempt.replacedBy !== extraNumbers[index]) {
        await this.setReplacedBy(attempt.id, extraNumbers[index], userId);
      }
    }
  }

  private async setReplacedBy(
    attemptId: string,
    extraNumber: number,
    userId: string,
  ) {
    const replaced = await this.prisma.attempt.update({
      where: { id: attemptId },
      data: {
        replacedBy: extraNumber,
        updatedBy: { connect: { id: userId } },
      },
    });
    await this.attemptEditLogService.log(
      replaced as AttemptSnapshot,
      new Date(),
      userId,
      `Replaced by extra ${extraNumber}`,
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
        data: {
          attemptNumber: i + 1,
          updatedBy: { connect: { id: userId } },
        },
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
      data: {
        status: newStatus,
        replacedBy: replacedByExtraNumber,
        updatedBy: { connect: { id: userId } },
      },
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
    const switchable = await this.getSwitchableGrant(grant.resultId);
    if (switchable?.id !== grant.id || grant.restoredAt) {
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
              // Kept so the extras can be used again without entering them
              statusInGrant: attempt.status,
              replacedByInGrant: attempt.replacedBy,
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

  async reapplyExtraGrant(grantId: string, userId: string) {
    const grant = await this.prisma.extraGrant.findUnique({
      where: { id: grantId },
      include: { attempts: true },
    });
    if (!grant) throw new HttpException('Extra grant not found', 404);
    await this.getResultForExtras(grant.resultId);
    const switchable = await this.getSwitchableGrant(grant.resultId);
    if (switchable?.id !== grant.id || !grant.restoredAt) {
      throw new HttpException('These extras are already in use', 409);
    }

    const reapplied = await this.prisma.$transaction(async (tx) => {
      await tx.extraGrant.update({
        where: { id: grant.id },
        data: { restoredAt: null },
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
              status: attempt.statusInGrant,
              replacedBy: attempt.replacedByInGrant,
              statusInGrant: null,
              replacedByInGrant: null,
              updatedBy: { connect: { id: userId } },
            },
          }),
        ),
      );
    });
    await this.logAll(reapplied, userId, 'Extras in use again');
    await this.resultService.settleWaitingExtras(grant.resultId);

    const competition = await this.prisma.competition.findFirst();
    await this.sendScorecardUnlessNever(grant.resultId, competition);
    this.appGateway.handleAttemptUpdated();
    return { reapplied: reapplied.length };
  }

  /**
   * A delegate rules that attempts stand as DNF, in one round or several, and
   * may disqualify the competitor from a round: its remaining attempts become
   * DNF (Regulation 2j1a)
   */
  async dnfAttempts(data: DnfAttemptsDto, userId: string) {
    if (!data.attemptIds.length && !data.remainingInResultId) {
      throw new HttpException('Nothing to set to DNF', 400);
    }
    const attempts = await this.prisma.attempt.findMany({
      where: { id: { in: data.attemptIds } },
      select: { resultId: true },
    });
    if (attempts.length !== data.attemptIds.length) {
      throw new HttpException('Attempt not found', 404);
    }
    const resultIds = [
      ...new Set([
        ...attempts.map((a) => a.resultId),
        ...(data.remainingInResultId ? [data.remainingInResultId] : []),
      ]),
    ];
    const results = await Promise.all(
      resultIds.map((id) => this.getResultForExtras(id)),
    );
    const competition = await this.prisma.competition.findFirst();
    const wcif = JSON.parse(JSON.stringify(competition.wcif));
    if (
      results.some(
        (result) => getRoundInfoFromWcif(result.roundId, wcif)?.format === 'h',
      )
    ) {
      throw new HttpException(
        'DNF all attempts is not available in head-to-head rounds',
        400,
      );
    }
    const targets = results.flatMap((result) =>
      getCountingAttempts(result.attempts).filter((attempt) =>
        data.attemptIds.includes(attempt.id),
      ),
    );
    if (
      targets.length !== data.attemptIds.length ||
      targets.some((attempt) => !isSolve(attempt))
    ) {
      throw new HttpException('These attempts cannot be set to DNF', 400);
    }
    const remainingResult = results.find(
      (result) => result.id === data.remainingInResultId,
    );
    const remaining = remainingResult
      ? this.getRemainingAttempts(remainingResult, targets, wcif)
      : { numbers: [], scrambled: [] };

    // Scrambled attempts have no history yet; this keeps them restorable
    for (const attempt of remaining.scrambled) {
      await this.attemptEditLogService.log(
        attempt as AttemptSnapshot,
        attempt.scrambledAt ?? new Date(Date.now() - 1000),
        null,
        'Scrambled',
      );
    }
    const { updated, added } = await this.prisma.$transaction(async (tx) => {
      for (const resultId of resultIds) {
        await tx.result.update({
          where: { id: resultId },
          data: this.doubleCheckCleared,
        });
      }
      const changed = await Promise.all(
        [...targets, ...remaining.scrambled].map((attempt) =>
          tx.attempt.update({
            where: { id: attempt.id },
            data: {
              penalty: DNF_VALUE,
              // A scrambled attempt now has its result
              ...(attempt.status === AttemptStatus.SCRAMBLED && {
                status: AttemptStatus.STANDARD,
              }),
              comment: data.comment,
              updatedBy: { connect: { id: userId } },
            },
          }),
        ),
      );
      const solvedAt = new Date();
      const created = await Promise.all(
        remaining.numbers.map((attemptNumber) =>
          tx.attempt.create({
            data: {
              attemptNumber,
              type: AttemptType.STANDARD_ATTEMPT,
              status: AttemptStatus.STANDARD,
              penalty: DNF_VALUE,
              value: 0,
              solvedAt,
              comment: data.comment,
              result: { connect: { id: remainingResult.id } },
              updatedBy: { connect: { id: userId } },
            },
          }),
        ),
      );
      return { updated: changed, added: created };
    });
    await this.logAll(updated, userId, RULED_DNF);
    await this.logAll(added, userId, REMAINING_RULED_DNF);

    for (const resultId of resultIds) {
      await this.sendScorecardUnlessNever(resultId, competition);
    }
    if (remainingResult) {
      this.appGateway.handleResultEntered(remainingResult.roundId);
    }
    this.appGateway.handleAttemptUpdated();
    return { updated: updated.length + added.length };
  }

  /**
   * The attempts a disqualification from the round records as DNF: up to the
   * cutoff if the competitor can no longer make it, otherwise every attempt
   */
  private getRemainingAttempts(
    result: { roundId: string; attempts: Attempt[] },
    targets: Attempt[],
    wcif: Competition,
  ) {
    const standard = getSortedStandardAttempts(result.attempts);
    if (!standard.length) {
      throw new HttpException(
        'No attempt started in this round, so no result is recorded',
        400,
      );
    }
    if (getAttemptsWaitingForExtra(result.attempts).length) {
      throw new HttpException(
        'Attempts are waiting for extras. Switch back to the originals first',
        409,
      );
    }
    const targetIds = targets.map((attempt) => attempt.id);
    const countingAfter = getCountingAttempts(result.attempts).map((attempt) =>
      targetIds.includes(attempt.id)
        ? { ...attempt, penalty: DNF_VALUE }
        : attempt,
    );
    const cutoff = getRoundInfoFromWcif(result.roundId, wcif)?.cutoff;
    const cutoffMissed =
      cutoff &&
      !checkCutoff(
        countingAfter.slice(0, cutoff.numberOfAttempts),
        cutoff.resultValue,
        0,
      );
    const last = cutoffMissed
      ? cutoff.numberOfAttempts
      : getNumberOfAttemptsForRound(result.roundId, wcif);
    const numbers = Array.from({ length: last }, (_, i) => i + 1).filter(
      (number) => !standard.some((attempt) => attempt.attemptNumber === number),
    );
    const scrambled = standard.filter(
      (attempt) =>
        attempt.status === AttemptStatus.SCRAMBLED &&
        attempt.attemptNumber <= last,
    );
    if (!numbers.length && !scrambled.length && !targets.length) {
      throw new HttpException('No attempts left', 400);
    }
    return { numbers, scrambled };
  }

  /** Attempts of a result under a DNF ruling, with how each was before */
  async getDnfRuling(resultId: string) {
    const attempts = await this.prisma.attempt.findMany({
      where: { resultId, penalty: DNF_VALUE },
      include: {
        editLogs: {
          select: {
            comment: true,
            penalty: true,
            status: true,
            editedAt: true,
          },
        },
      },
    });
    return attempts.flatMap((attempt) => {
      const before = getStateBeforeRuling(attempt.penalty, attempt.editLogs);
      if (!before) return [];
      return [
        before.addedByRuling
          ? { id: attempt.id, addedByRuling: true, penaltyBeforeDnf: null }
          : {
              id: attempt.id,
              addedByRuling: false,
              penaltyBeforeDnf: before.penalty,
              statusBeforeDnf: before.status,
            },
      ];
    });
  }

  /**
   * Undo a DNF ruling: the attempts get their own penalty back, and remaining
   * attempts it recorded are removed so the competitor can do them
   */
  async restoreDnfAttempts(resultId: string, userId: string) {
    const result = await this.getResultForExtras(resultId);
    const ruled = await this.getDnfRuling(resultId);
    if (!ruled.length) {
      throw new HttpException('No attempts were ruled DNF', 400);
    }
    const toRestore = ruled.filter((attempt) => !attempt.addedByRuling);
    const toRemove = ruled.filter((attempt) => attempt.addedByRuling);

    const restored = await this.prisma.$transaction(async (tx) => {
      await tx.result.update({
        where: { id: resultId },
        data: this.doubleCheckCleared,
      });
      await tx.attempt.deleteMany({
        where: { id: { in: toRemove.map((attempt) => attempt.id) } },
      });
      return Promise.all(
        toRestore.map((attempt) =>
          tx.attempt.update({
            where: { id: attempt.id },
            data: {
              penalty: attempt.penaltyBeforeDnf,
              status: attempt.statusBeforeDnf,
              updatedBy: { connect: { id: userId } },
            },
          }),
        ),
      );
    });
    await this.logAll(restored, userId, DNF_RULING_UNDONE);

    const competition = await this.prisma.competition.findFirst();
    await this.sendScorecardUnlessNever(resultId, competition);
    if (toRemove.length) this.appGateway.handleResultEntered(result.roundId);
    this.appGateway.handleAttemptUpdated();
    return { restored: restored.length, removed: toRemove.length };
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
    const grant = await this.getSwitchableGrant(resultId);
    return {
      hasNextGroup,
      nextRoundStarted: nextRoundAttempts > 0,
      grant: grant && {
        id: grant.id,
        usingOriginals: !!grant.restoredAt,
        attemptIds: grant.attempts.map((a) => a.id),
      },
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

  /** The grant in use, otherwise the one set aside last */
  private async getSwitchableGrant(resultId: string) {
    const include = { attempts: { select: { id: true } } };
    return (
      (await this.prisma.extraGrant.findFirst({
        where: { resultId, restoredAt: null },
        orderBy: { createdAt: 'desc' },
        include,
      })) ??
      this.prisma.extraGrant.findFirst({
        where: { resultId, restoredAt: { not: null } },
        orderBy: { restoredAt: 'desc' },
        include,
      })
    );
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
      data: {
        attemptNumber: secondAttempt.attemptNumber,
        updatedBy: { connect: { id: userId } },
      },
    });
    const updatedSecond = await this.prisma.attempt.update({
      where: { id: secondAttemptId },
      data: {
        attemptNumber: firstAttempt.attemptNumber,
        updatedBy: { connect: { id: userId } },
      },
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
      include: { result: { select: { personId: true, roundId: true } } },
    });
    if (!attemptToUpdate) {
      throw new HttpException('Attempt not found', 404);
    }
    // An attempt saved over the cap before it existed can still be edited otherwise
    if (data.penalty !== attemptToUpdate.penalty) {
      assertPenaltyAllowed(data.penalty, attemptToUpdate.result.roundId);
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
        await this.setReplacedBy(
          attemptToReplace.id,
          attempt.attemptNumber,
          userId,
        );
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
    }
    this.appGateway.handleAttemptUpdated();
    if (allAttempts === 0) {
      return {
        resultDeleted: true,
      };
    }
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
    if (!attempt) throw new HttpException('Attempt not found', 404);
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
