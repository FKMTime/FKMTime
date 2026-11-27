import { forwardRef, HttpException, Inject, Injectable } from '@nestjs/common';
import { AppGateway } from 'src/app.gateway';
import {
  AttemptEditLogService,
  AttemptSnapshot,
} from 'src/attempt-edit-log/attempt-edit-log.service';
import { AttendanceService } from 'src/attendance/attendance.service';
import { CompetitionService } from 'src/competition/competition.service';
import { DNF_VALUE, DNS_VALUE, publicPersonSelect } from 'src/constants';
import { getMaxPenalty, isUnofficialEvent } from 'src/events';
import { H2hMatchService } from 'src/h2h/h2hMatch.service';
import { isH2hRound } from 'src/h2h/h2hRound';
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

import {
  DbService,
  INCLUDING_REMOVED,
  runInTransaction,
  Tx,
} from '../db/db.service';
import {
  Attempt,
  AttemptStatus,
  AttemptType,
  SendingResultsFrequency,
  StaffRole,
} from '../generated/prisma/client';
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

const roundNumber = (roundId: string) => +roundId.split('-r')[1];

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
    @Inject(forwardRef(() => CompetitionService))
    private readonly competitionService: CompetitionService,
    private readonly h2hMatchService: H2hMatchService,
  ) {}

  private async getWcif(): Promise<Competition> {
    const competition = await this.prisma.competition.findFirstOrThrow();
    return JSON.parse(JSON.stringify(competition.wcif));
  }

  async createAttempt(data: CreateAttemptDto, userId: string) {
    // Validate before getResultOrCreate, so a rejected attempt leaves no empty result behind
    if (data.judgeId && data.judgeId === data.competitorId) {
      throw new HttpException(
        'Judge cannot be the same person as competitor',
        400,
      );
    }
    assertPenaltyAllowed(data.penalty, data.roundId);
    if (isH2hRound(data.roundId, await this.getWcif())) {
      return this.createH2hAttempt(data, userId);
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
        ...this.attemptCreateData(data, userId, result.id, data.attemptNumber),
        replacedBy: data.replacedBy ? data.replacedBy : null,
      },
    });
    await this.attemptEditLogService.log(
      createdAttempt as AttemptSnapshot,
      createdAttempt.solvedAt ?? new Date(),
      userId,
      'Manually entered',
    );

    await this.attendanceService.markCompetitorAsPresent(
      result.person.id,
      await this.competingGroupId(data),
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
      await this.resultService.sendResult(result.id);
    }
    this.appGateway.handleResultEntered(result.roundId);
    this.competitionService.requestGroupChangeCheck(result.roundId);
    return {
      message: 'Attempt created successfully',
    };
  }

  /** The group the competitor is in for the round, for their attendance */
  private async competingGroupId(data: CreateAttemptDto) {
    const staffActivity = await this.prisma.staffActivity.findFirst({
      where: {
        personId: data.competitorId,
        groupId: { startsWith: `${data.roundId}-g` },
        role: StaffRole.COMPETITOR,
      },
    });
    return isUnofficialEvent(data.roundId.split('-')[0])
      ? `${data.roundId}-g1`
      : staffActivity
        ? staffActivity.groupId
        : `${data.roundId}-g1`;
  }

  /** The new attempt's row, numbered as the caller says */
  private attemptCreateData(
    data: CreateAttemptDto,
    userId: string,
    resultId: string,
    attemptNumber: number,
  ) {
    return {
      attemptNumber,
      value: data.value,
      penalty: data.penalty,
      solvedAt: new Date(),
      device: data.deviceId ? { connect: { id: data.deviceId } } : undefined,
      judge: data.judgeId ? { connect: { id: data.judgeId } } : undefined,
      scrambler: data.scramblerId
        ? { connect: { id: data.scramblerId } }
        : undefined,
      updatedBy: { connect: { id: userId } },
      status: data.status,
      type: data.type,
      comment: data.comment,
      result: { connect: { id: resultId } },
    };
  }

  /**
   * An attempt typed in for a head-to-head round goes into the competitor's
   * playing match, like a station's will (SPEC-001). Its number is the
   * competitor's next in the round, whatever the form said, and nothing is
   * saved when it has no point to go to.
   */
  private async createH2hAttempt(data: CreateAttemptDto, userId: string) {
    if (
      data.type !== AttemptType.STANDARD_ATTEMPT ||
      data.status !== AttemptStatus.STANDARD
    ) {
      throw new HttpException(
        "In a head-to-head round, enter the point's result as a standard attempt. Extras are granted on the point, for both competitors.",
        400,
      );
    }
    const groupId = await this.competingGroupId(data);
    const { roundId, matchId } = await runInTransaction(
      this.prisma,
      async (tx) => {
        const result =
          await this.resultService.getResultOrCreateIncludingRemoved(
            data.competitorId,
            data.roundId,
            tx,
          );
        if (result.removedAt) {
          throw new HttpException(
            'Removed from this round (Regulation 9t)',
            409,
          );
        }
        const recorded = await this.h2hMatchService.recordAttempt(tx, {
          roundId: data.roundId,
          personId: data.competitorId,
          resultId: result.id,
          create: (attemptNumber, type) =>
            tx.db.attempt.create({
              data: {
                ...this.attemptCreateData(
                  data,
                  userId,
                  result.id,
                  attemptNumber,
                ),
                type,
              },
            }),
        });
        await this.attemptEditLogService.log(
          recorded.attempt as AttemptSnapshot,
          recorded.attempt.solvedAt ?? new Date(),
          userId,
          'Manually entered',
          tx,
        );
        if (recorded.replaced) {
          await this.attemptEditLogService.log(
            recorded.replaced as AttemptSnapshot,
            new Date(),
            userId,
            `Replaced by extra ${recorded.attempt.attemptNumber}`,
            tx,
          );
        }
        await this.attendanceService.markCompetitorAsPresent(
          data.competitorId,
          groupId,
          data.deviceId ?? '',
          tx,
        );
        return { roundId: result.roundId, matchId: recorded.matchId };
      },
    );
    this.appGateway.handleResultEntered(roundId);
    this.competitionService.requestGroupChangeCheck(roundId);
    return { message: 'Attempt created successfully', matchId };
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
      .flatMap((attempt) => attempt.replacedBy ?? [])
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

  /** Creates the result with the first new attempt, so a blank scorecard saves nothing */
  async enterScorecard(data: EnterScorecardDto, userId: string) {
    if (data.attempts.length === 0 && data.newAttempts.length === 0) {
      throw new HttpException('Enter at least one time to save', 400);
    }
    const isThisScorecard = (a: { roundId: string; competitorId: string }) =>
      a.roundId === data.roundId && a.competitorId === data.personId;
    if (!data.newAttempts.every(isThisScorecard)) {
      throw new HttpException(
        'Every attempt must be for this competitor and round',
        400,
      );
    }
    const updated = await this.prisma.attempt.findMany({
      where: { id: { in: data.attempts.map((a) => a.id) } },
      select: { result: { select: { personId: true, roundId: true } } },
    });
    if (
      updated.length !== data.attempts.length ||
      !updated.every((a) =>
        isThisScorecard({
          roundId: a.result.roundId,
          competitorId: a.result.personId,
        }),
      )
    ) {
      throw new HttpException(
        'Every attempt must be for this competitor and round',
        400,
      );
    }

    for (const attempt of data.attempts) {
      await this.updateAttempt(attempt.id, attempt, userId);
    }
    for (const attempt of data.newAttempts) {
      await this.createAttempt(attempt, userId);
    }
    const result = await this.prisma.result.findUniqueOrThrow({
      where: {
        personId_roundId: { personId: data.personId, roundId: data.roundId },
      },
      select: { id: true },
    });
    return {
      message: 'Scorecard entered successfully',
      resultId: result.id,
    };
  }

  async reorderAttempts(
    attemptIds: string[],
    resultId: string,
    userId: string,
  ) {
    await this.h2hMatchService.assertNotRenumbered(this.prisma, attemptIds);
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
    await this.resultService.sendResult(resultId);
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
    await this.h2hMatchService.assertNotRenumbered(this.prisma, [id]);

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

    await this.resultService.sendResult(attempt.resultId);
    this.appGateway.handleAttemptUpdated();
    return { message: 'Replacement updated successfully' };
  }

  async giveExtras(data: GiveExtrasDto, userId: string) {
    const result = await this.getResultForExtras(data.resultId);
    const competition = await this.prisma.competition.findFirstOrThrow();
    const wcif = JSON.parse(JSON.stringify(competition.wcif));
    if (isH2hRound(result.roundId, wcif)) {
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

    // Giving the extras recorded what each attempt was before
    const toRestore = grant.attempts.map((attempt) => {
      if (!attempt.statusBeforeGrant) {
        throw new HttpException(
          `Attempt ${attempt.id} has no status from before the grant`,
          500,
        );
      }
      return { ...attempt, statusBeforeGrant: attempt.statusBeforeGrant };
    });
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
        toRestore.map((attempt) =>
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

    const competition = await this.prisma.competition.findFirstOrThrow();
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

    // Restoring the grant recorded what each attempt was in it
    const toReapply = grant.attempts.map((attempt) => {
      if (!attempt.statusInGrant) {
        throw new HttpException(
          `Attempt ${attempt.id} has no status from the grant`,
          500,
        );
      }
      return { ...attempt, statusInGrant: attempt.statusInGrant };
    });
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
        toReapply.map((attempt) =>
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

    const competition = await this.prisma.competition.findFirstOrThrow();
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
    const competition = await this.prisma.competition.findFirstOrThrow();
    const wcif = JSON.parse(JSON.stringify(competition.wcif));
    if (results.some((result) => isH2hRound(result.roundId, wcif))) {
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
    const { trigger, laterResults } = data.removeLaterRounds
      ? await this.getLaterResults(results, targets, remainingResult)
      : { trigger: null, laterResults: [] };
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
      const created = remainingResult
        ? await Promise.all(
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
          )
        : [];
      // Later rounds are found from a trigger, so there are none without one
      if (trigger) {
        for (const later of laterResults) {
          await tx.result.update({
            where: { id: later.id },
            data: {
              removedAt: new Date(),
              removedBy: { connect: { id: userId } },
              removedReason: data.comment,
              removedByRulingOf: { connect: { id: trigger.id } },
            },
          });
        }
      }
      return { updated: changed, added: created };
    });
    await this.logAll(updated, userId, RULED_DNF);
    await this.logAll(added, userId, REMAINING_RULED_DNF);

    // A removed result goes out empty, taking its times off WCA Live
    for (const resultId of [...resultIds, ...laterResults.map((r) => r.id)]) {
      await this.sendScorecardUnlessNever(resultId, competition);
    }
    for (const result of [remainingResult, ...laterResults].filter(
      (found) => found !== undefined,
    )) {
      this.appGateway.handleResultEntered(result.roundId);
    }
    this.appGateway.handleAttemptUpdated();
    // A ruling can finish a competitor, and a removed result leaves its group
    const roundIds = new Set(
      [...results, ...laterResults].map((result) => result.roundId),
    );
    for (const roundId of roundIds) {
      this.competitionService.requestGroupChangeCheck(roundId);
    }
    return {
      updated: updated.length + added.length,
      removedResults: laterResults.length,
    };
  }

  /**
   * Regulation 9t: the competitor's results in rounds after the earliest one
   * this ruling changes. Their attempts can't be ruled too, as they go whole.
   */
  private async getLaterResults(
    results: {
      id: string;
      personId: string;
      eventId: string;
      roundId: string;
    }[],
    targets: Attempt[],
    remainingResult?: { id: string; roundId: string },
  ) {
    const changed = results.filter(
      (result) =>
        result.id === remainingResult?.id ||
        targets.some((attempt) => attempt.resultId === result.id),
    );
    const trigger = changed.reduce((earliest, result) =>
      roundNumber(result.roundId) < roundNumber(earliest.roundId)
        ? result
        : earliest,
    );
    const laterResults = (
      await this.prisma.result.findMany({
        where: { personId: trigger.personId, eventId: trigger.eventId },
        include: { attempts: { select: { status: true } } },
      })
    ).filter(
      (result) => roundNumber(result.roundId) > roundNumber(trigger.roundId),
    );
    if (laterResults.some((later) => changed.some((r) => r.id === later.id))) {
      throw new HttpException(
        'Attempts in rounds being removed cannot be set to DNF',
        400,
      );
    }
    const withIncident = laterResults.find((result) =>
      result.attempts.some((a) => a.status === AttemptStatus.UNRESOLVED),
    );
    if (withIncident) {
      throw new HttpException(
        `Resolve the open incident in round ${roundNumber(withIncident.roundId)} first`,
        409,
      );
    }
    return { trigger, laterResults };
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

  /**
   * Attempts of a result under a DNF ruling, with how each was before, and the
   * later-round results the ruling removed
   */
  async getDnfRuling(resultId: string) {
    const [attempts, removedResults] = await Promise.all([
      this.getRuledAttempts(resultId),
      this.prisma.result.findMany({
        where: { removedByRulingOfId: resultId, ...INCLUDING_REMOVED },
        select: { id: true, roundId: true },
      }),
    ]);
    return { attempts, removedResults };
  }

  private async getRuledAttempts(resultId: string) {
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
    const { attempts: ruled, removedResults } =
      await this.getDnfRuling(resultId);
    if (!ruled.length && !removedResults.length) {
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
      for (const removed of removedResults) {
        await tx.result.update({
          where: { id: removed.id },
          data: this.resultService.notRemoved,
        });
      }
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

    const competition = await this.prisma.competition.findFirstOrThrow();
    for (const id of [resultId, ...removedResults.map((r) => r.id)]) {
      await this.sendScorecardUnlessNever(id, competition);
    }
    if (toRemove.length) this.appGateway.handleResultEntered(result.roundId);
    for (const removed of removedResults) {
      this.appGateway.handleResultEntered(removed.roundId);
    }
    this.appGateway.handleAttemptUpdated();
    return {
      restored: restored.length,
      removed: toRemove.length,
      broughtBack: removedResults.length,
    };
  }

  /** What the delegate needs to know before giving extras for a result */
  async getExtrasContext(resultId: string) {
    const result = await this.prisma.result.findUnique({
      where: { id: resultId },
    });
    if (!result) throw new HttpException('Result not found', 404);
    const competition = await this.prisma.competition.findFirstOrThrow();
    const wcif = JSON.parse(JSON.stringify(competition.wcif));
    const rooms = await this.prisma.room.findMany();
    const hasNextGroup = rooms.some((room) =>
      room.currentGroupIds.some(
        (groupId) =>
          groupId.split('-g')[0] === result.roundId &&
          getNextGroupInRoom(groupId, room.name, wcif),
      ),
    );
    const eventId = result.roundId.split('-r')[0];
    const nextRoundAttempts = await this.prisma.attempt.count({
      where: {
        result: { roundId: `${eventId}-r${roundNumber(result.roundId) + 1}` },
      },
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
    if (result.removedAt) {
      throw new HttpException('Removed from this round (Regulation 9t)', 409);
    }
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
      await this.resultService.sendResult(resultId);
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
    if (!firstAttempt || !secondAttempt) {
      throw new HttpException('Attempt not found', 404);
    }
    await this.h2hMatchService.assertNotRenumbered(this.prisma, [
      attemptId,
      secondAttemptId,
    ]);

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
      include: {
        result: { select: { personId: true, roundId: true, removedAt: true } },
      },
    });
    if (!attemptToUpdate) {
      throw new HttpException('Attempt not found', 404);
    }
    if (attemptToUpdate.result.removedAt) {
      throw new HttpException('Removed from this round (Regulation 9t)', 409);
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

    // An attempt raced on a head-to-head point (SPEC-001)
    const point = await this.h2hMatchService.pointOf(this.prisma, id);
    if (point) {
      if (
        data.attemptNumber !== attemptToUpdate.attemptNumber ||
        data.type !== attemptToUpdate.type
      ) {
        throw new HttpException(
          "Attempts in a head-to-head round are numbered by their matches, so the number and type can't change",
          400,
        );
      }
      if (data.status === AttemptStatus.EXTRA_GIVEN) {
        throw new HttpException(
          'In a head-to-head round an extra goes to both competitors. Use Extra granted on the point in the Matches tab.',
          400,
        );
      }
    }
    // Replaced by an extra on a point: it stays out of play for good
    const race = point
      ? null
      : await this.h2hMatchService.findRace(this.prisma, [id]);
    if (race?.replaced) {
      // Extra granted, or voided when its match ended before the re-race
      if (
        data.status !== attemptToUpdate.status ||
        data.attemptNumber !== attemptToUpdate.attemptNumber ||
        data.type !== attemptToUpdate.type
      ) {
        throw new HttpException(
          `This attempt was replaced by an extra on ${race.label}, set ${race.setNumber}, point ${race.pointNumber}, so its status, number and type stay as they are. Its time, penalty and comment can still be corrected.`,
          400,
        );
      }
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

    // A replaced head-to-head race points at the attempt that raced the
    // point again, whatever the form says
    const replacedBy = race?.replaced
      ? attemptToUpdate.replacedBy
      : data.status !== AttemptStatus.EXTRA_GIVEN || data.replacedBy === 0
        ? null
        : data.replacedBy;
    const dataToUpdate = {
      attemptNumber: data.attemptNumber,
      replacedBy,
      penalty: data.penalty,
      status: data.status,
      type: data.type,
      value: data.value,
      comment: data.comment,
    };

    const write = async (tx?: Tx) => {
      const updated = await (tx?.db ?? this.prisma).attempt.update({
        where: { id: id },
        data: {
          ...dataToUpdate,
          judge: data.judgeId ? { connect: { id: data.judgeId } } : undefined,
          device: data.deviceId
            ? { connect: { id: data.deviceId } }
            : undefined,
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
        updated as AttemptSnapshot,
        new Date(),
        userId,
        'Updated',
        tx,
      );
      return updated;
    };
    // In a match still playing, the point, set and match are decided again;
    // a finished match keeps its winners (11l1), only the time changes
    const attempt = point
      ? await runInTransaction(this.prisma, async (tx) => {
          const locked = await this.h2hMatchService.lockPointOf(tx.db, id);
          // Taken off its point meanwhile (an extra granted on it): what
          // was checked above no longer holds
          if (!locked) {
            throw new HttpException(
              'This attempt changed while you were editing it. Reload and try again.',
              409,
            );
          }
          const updated = await write(tx);
          const { match } = locked.set;
          await this.h2hMatchService.settle(tx.db, match.id);
          tx.afterCommit(() =>
            this.appGateway.handleH2hUpdated(match.bracket.roundId, match.id),
          );
          return updated;
        })
      : await write();
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
    // Resolving an incident is often what the group was waiting for
    this.competitionService.requestGroupChangeCheck(
      attemptToUpdate.result.roundId,
    );
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
        await this.resultService.sendResult(result.id);
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
        result: { select: { roundId: true } },
      },
    });
    if (!attempt) {
      throw new HttpException('Attempt not found', 404);
    }

    // An attempt raced on a head-to-head point decided it, so only the lone
    // attempt of a playing match's open point can go
    const race = await this.h2hMatchService.findRace(this.prisma, [id]);
    if (race?.replaced) {
      throw new HttpException(
        `This attempt was replaced by an extra on ${race.label}, set ${race.setNumber}, point ${race.pointNumber}. It stays as the record of that race, so it can't be deleted.`,
        409,
      );
    }
    if (race) {
      await runInTransaction(this.prisma, async (tx) => {
        const point = await this.h2hMatchService.releaseFromPoint(tx.db, id);
        await tx.db.attempt.delete({ where: { id } });
        if (point) {
          const { match } = point.set;
          await this.h2hMatchService.settle(tx.db, match.id);
          tx.afterCommit(() =>
            this.appGateway.handleH2hUpdated(match.bracket.roundId, match.id),
          );
        }
      });
    } else {
      await this.prisma.attempt.delete({
        where: { id: id },
      });
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
    await this.resultService.sendResult(attempt.resultId);

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
    // Deleting an open incident or a stray attempt can finish the group
    this.competitionService.requestGroupChangeCheck(attempt.result.roundId);
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
        h2hPointAsA: { select: { id: true } },
        h2hPointAsB: { select: { id: true } },
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
    const { h2hPointAsA, h2hPointAsB, ...rest } = attempt;
    return {
      // An attempt on a head-to-head point gets its extra on the point
      attempt: {
        ...rest,
        h2hPointId: (h2hPointAsA ?? h2hPointAsB)?.id ?? null,
      },
      previousIncidents,
    };
  }
}
