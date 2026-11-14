import { forwardRef, Inject, Logger } from '@nestjs/common';
import {
  AttemptStatus,
  AttemptType,
  Device,
  DeviceType,
  Person,
  Result,
  SendingResultsFrequency,
} from '@prisma/client';
import { AppGateway } from 'src/app.gateway';
import {
  AttemptEditLogService,
  AttemptSnapshot,
} from 'src/attempt-edit-log/attempt-edit-log.service';
import { AttendanceService } from 'src/attendance/attendance.service';
import { DNS_VALUE } from 'src/constants';
import { DbService, runInTransaction, Tx } from 'src/db/db.service';
import { DeviceService } from 'src/device/device.service';
import {
  getCompetitorGroupInRound,
  getStationRoundIds,
  groupIdToRoundId,
  isPointedStation,
} from 'src/device/stationRounds';
import { isUnofficialEvent } from 'src/events';
import { PersonService } from 'src/person/person.service';
import { CreateScrambledAttemptDto } from 'src/scrambling/dto/createScrambledAttempt.dto';
import {
  getTranslation,
  isLocaleAvailable,
} from 'src/translations/translations';
import { getMaxAttempts } from 'src/wcif-helpers';
import { getPersonFromWcif, getRoundInfoFromWcif } from 'wcif-helpers';

import { EnterAttemptDto } from './dto/enterAttempt.dto';
import {
  checkAttemptLimit,
  checkCutoff,
  getAttemptsWaitingForExtra,
  getCountingAttempts,
  getNextExtraNumber,
  getRoundResultText,
  getSortedStandardAttempts,
  isCompetitorSignedInForEvent,
  isSameAttemptResent,
} from './helpers';
import { ResultService } from './result.service';

/**
 * Waiting for a free connection, and for the whole entry. The connector gives
 * up on a reply after 7.5 s, and the station then resends the solve
 */
const ENTER_ATTEMPT_TRANSACTION = { maxWait: 5_000, timeout: 7_500 };

export class ResultFromDeviceService {
  constructor(
    private readonly prisma: DbService,
    private readonly appGateway: AppGateway,
    private readonly attendanceService: AttendanceService,
    @Inject(forwardRef(() => DeviceService))
    private readonly deviceService: DeviceService,
    private readonly personService: PersonService,
    private readonly resultService: ResultService,
    private readonly attemptEditLogService: AttemptEditLogService,
  ) {}

  private logger = new Logger('ResultFromDeviceService');

  /**
   * The language a station reply is shown in: the judge's when the judge and
   * the competitor share a country and it is available, otherwise the
   * competition's
   */
  private getReaderLocale(
    competitor: Pick<Person, 'countryIso2'> | null,
    judge: Pick<Person, 'countryIso2'> | null,
    defaultLocale: string,
  ) {
    const country = judge?.countryIso2?.toLowerCase();
    if (
      competitor &&
      country &&
      judge.countryIso2 === competitor.countryIso2 &&
      isLocaleAvailable(country)
    ) {
      return country;
    }
    return defaultLocale;
  }

  async getStationByEspId(espId: number) {
    return await this.deviceService.getDeviceByEspId(espId, DeviceType.STATION);
  }

  /**
   * Everything an attempt writes is one transaction: one commit, so one wait
   * for the disk instead of one per write, and no half-entered attempt if a
   * write fails. A slow disk on the router made each commit cost up to
   * seconds during a competition.
   */
  async enterAttempt(data: EnterAttemptDto) {
    return runInTransaction(
      this.prisma,
      (tx) => this.enterAttemptInTransaction(data, tx),
      ENTER_ATTEMPT_TRANSACTION,
    );
  }

  private async enterAttemptInTransaction(data: EnterAttemptDto, tx: Tx) {
    // A station resends a solve whose reply it lost. The first send's attempt
    // isn't visible until it commits, so the resend waits for it here and is
    // then answered as already entered, instead of entering it twice
    await tx.db
      .$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`enter-attempt:${data.espId}:${data.sessionId}`}))`;
    const competition = await tx.db.competition.findFirst();
    if (!competition) {
      return {
        message: getTranslation('competitionNotFound', 'en'),
        shouldResetTime: true,
        status: 404,
        error: true,
      };
    }

    const device = await this.getStationByEspId(data.espId);
    if (!device) {
      return {
        message: getTranslation('stationNotFound', competition.defaultLocale),
        shouldResetTime: false,
        status: 404,
        error: true,
      };
    }
    const stationRoundIds = getStationRoundIds(device);
    if (stationRoundIds.length === 0) {
      return {
        message: getTranslation('noGroups', competition.defaultLocale),
        status: 400,
        shouldResetTime: false,
        error: true,
      };
    }
    const isPointed = isPointedStation(device);
    // The station sends the group it was given at the card scan. A solve from
    // a round the station no longer takes (its room or a delegate changed it
    // mid-solve) must not land in the new round (SPEC-007)
    let roundId: string;
    if (data.groupId) {
      roundId = groupIdToRoundId(data.groupId);
      // A solve resent after a lost reply is answered as already entered below
      const isResent = !!(await tx.db.attempt.findFirst({
        where: { sessionId: data.sessionId, deviceId: device.id },
        select: { id: true },
      }));
      if (!stationRoundIds.includes(roundId) && !isResent) {
        // In the language the judge and competitor read, like every other reply
        const [competitor, judge] = await Promise.all([
          this.personService.getPersonByCardId(data.competitorId.toString()),
          data.judgeId
            ? this.personService.getPersonByCardId(data.judgeId.toString())
            : null,
        ]);
        return {
          message: getTranslation(
            'stationRoundChanged',
            this.getReaderLocale(competitor, judge, competition.defaultLocale),
          ),
          shouldResetTime: false,
          status: 409,
          error: true,
        };
      }
    } else if (stationRoundIds.length === 1) {
      roundId = stationRoundIds[0];
    } else {
      return {
        message: getTranslation('groupNotFound', competition.defaultLocale),
        shouldResetTime: false,
        status: 400,
        error: true,
      };
    }

    const competitor = await this.personService.getPersonByCardId(
      data.competitorId.toString(),
    );
    // The competition language until a judge card tells us who is reading
    let locale = competition.defaultLocale;
    if (!competitor) {
      return {
        message: getTranslation('competitorNotFound', locale),
        shouldResetTime: true,
        status: 404,
        error: true,
      };
    }
    const wcif = JSON.parse(JSON.stringify(competition.wcif));
    // A pointed station times a round whose groups are over: the competitor
    // counts only in their own group, and nobody new is added to it
    const groupId = isPointed
      ? getCompetitorGroupInRound(roundId, competitor.registrantId, wcif)
      : (device.room.currentGroupIds.find((g) => g === data.groupId) ??
        device.room.currentGroupIds.find(
          (g) => groupIdToRoundId(g) === roundId,
        ));
    if (groupId) {
      await this.attendanceService.markCompetitorAsPresent(
        competitor.id,
        groupId,
        device.id,
        tx,
      );
    }

    const previousAttemptWithSameSessionId = await tx.db.attempt.findFirst({
      where: {
        sessionId: data.sessionId,
        deviceId: device.id,
      },
      include: { result: { select: { personId: true } } },
    });
    if (previousAttemptWithSameSessionId) {
      if (previousAttemptWithSameSessionId.status === AttemptStatus.RESOLVED) {
        if (data.judgeId) {
          return this.updateResolvedIncident(
            previousAttemptWithSameSessionId.id,
            data.judgeId.toString(),
            locale,
            tx,
          );
        } else {
          return {
            message: getTranslation('judgeCardNotScanned', locale),
            shouldResetTime: false,
            status: 400,
            error: true,
          };
        }
      }
      // The reply to the first send was lost: the station may drop its copy,
      // but only if it is the attempt we have, unchanged
      const judge = data.judgeId
        ? await this.personService.getPersonByCardId(data.judgeId.toString())
        : null;
      const sameAttempt = isSameAttemptResent(
        previousAttemptWithSameSessionId,
        {
          value: data.value,
          valueMs: data.valueMs,
          inspectionTime: data.inspectionTime,
          penalty: data.penalty,
          competitorId: competitor.id,
          judgeId: judge?.id ?? null,
        },
      );
      return {
        message: getTranslation('attemptAlreadyEntered', locale),
        shouldResetTime: sameAttempt,
        status: 409,
        error: true,
      };
    }

    // judgeId is optional: a delegate call can come without a judge card
    const judge = data.judgeId
      ? await this.personService.getPersonByCardId(data.judgeId.toString())
      : null;

    if (!judge && !data.isDelegate) {
      return {
        message: getTranslation('judgeNotFound', locale),
        shouldResetTime: false,
        status: 404,
        error: true,
      };
    }
    if (judge && judge.id === competitor.id) {
      return {
        message: getTranslation('judgeIsCompetitor', locale),
        shouldResetTime: false,
        status: 400,
        error: true,
      };
    }

    if (judge) {
      // The judge of a redo is usually staffing the room's current group
      if (!isPointed && groupId) {
        await this.attendanceService.markJudgeAsPresent(
          judge.id,
          groupId,
          device.id,
          tx,
        );
      }
      locale = this.getReaderLocale(
        competitor,
        judge,
        competition.defaultLocale,
      );
    }

    const currentRoundId = roundId;
    const roundInfo = getRoundInfoFromWcif(currentRoundId, wcif);
    const competitorWcifInfo = getPersonFromWcif(competitor.registrantId, wcif);
    const competitorSignedInForEvent = isCompetitorSignedInForEvent(
      competitorWcifInfo,
      currentRoundId.split('-')[0],
    );
    if (
      !competitorSignedInForEvent &&
      !isUnofficialEvent(currentRoundId.split('-')[0])
    ) {
      return {
        message: getTranslation('competitorIsNotSignedInForEvent', locale),
        shouldResetTime: false,
        status: 400,
        error: true,
      };
    }
    const result = await this.resultService.getResultOrCreateIncludingRemoved(
      competitor.id,
      currentRoundId,
      tx,
    );
    if (result.removedAt) {
      return {
        message: getTranslation('competitorRemovedFromRound', locale),
        shouldResetTime: false,
        status: 409,
        error: true,
      };
    }

    const attempts = await tx.db.attempt.findMany({
      where: {
        resultId: result.id,
        status: {
          not: AttemptStatus.SCRAMBLED,
        },
      },
    });

    const finalData = await this.getValidatedData(
      competitor.id,
      roundInfo,
      data,
    );

    if (!finalData.cutoffPassed) {
      return {
        message: getTranslation('cutoffNotPassed', locale),
        shouldResetTime: true,
        status: 400,
        error: true,
      };
    }
    const sortedAttempts = getSortedStandardAttempts(attempts);

    let extraEntered = false;
    const [attemptToReplace] = getAttemptsWaitingForExtra(attempts);
    if (attemptToReplace) {
      const extraAttempt =
        await this.createAnExtraAttemptAnReplaceTheOriginalOne(
          {
            ...finalData,
            device,
            judge,
            competitor,
            result,
            attemptNumber: getNextExtraNumber(attempts),
          },
          attemptToReplace.id,
          tx,
        );
      extraEntered = true;
      if (data.isDelegate) {
        return this.notifyDelegate(
          device.name,
          competitor.name,
          locale,
          extraAttempt.id,
          tx,
        );
      }
      const voided = await this.resultService.settleWaitingExtras(
        result.id,
        tx,
      );
      if (finalData.dnsOther && voided === 0) {
        await this.dnsRemainingAttempts(
          result.id,
          getMaxAttempts(roundInfo.format),
          tx,
        );
      }
    }
    if (!extraEntered) {
      let attemptNumber = 1;
      const maxAttempts = getMaxAttempts(roundInfo.format);
      const lastAttempt = sortedAttempts[sortedAttempts.length - 1];
      if (lastAttempt && lastAttempt.attemptNumber === maxAttempts) {
        return {
          message: getTranslation('noAttemptsLeft', locale),
          shouldResetTime: false,
          status: 400,
          error: true,
        };
      }
      if (lastAttempt) {
        attemptNumber = lastAttempt.attemptNumber + 1;
      }
      const attempt = await this.createOrUpdateScrambledAttempt(
        data,
        AttemptType.STANDARD_ATTEMPT,
        attemptNumber,
        finalData,
        device,
        result,
        judge as Person,
        tx,
      );
      if (data.isDelegate) {
        return this.notifyDelegate(
          device.name,
          competitor.name,
          locale,
          attempt.id,
          tx,
        );
      }
      if (finalData.dnsOther) {
        await this.dnsOtherAttempts(attemptNumber, maxAttempts, result.id, tx);
      }
    }
    if (
      competition.sendingResultsFrequency ===
      SendingResultsFrequency.AFTER_SOLVE
    ) {
      tx.afterCommit(() => this.enterResultToExternalService(result.id));
    }
    tx.afterCommit(() => {
      this.appGateway.handleResultEntered(result.roundId);
      this.appGateway.recordLastSolve(data.espId, {
        personName: competitor.name,
        value: finalData.value,
        penalty: finalData.penalty,
        enteredAt: Date.now(),
      });
    });
    const enteredMessage = finalData.limitPassed
      ? getTranslation('attemptEntered', locale)
      : getTranslation('attemptEnteredButReplacedToDnf', locale);
    const roundResultText = await this.getFinishedRoundResultText(
      result.id,
      roundInfo,
      tx,
    );
    return {
      // The station shows the first two words on the top line and the rest
      // below, so the two-word result goes first to get a line of its own
      message: roundResultText
        ? `${roundResultText} ${enteredMessage}`
        : enteredMessage,
      shouldResetTime: true,
      status: 200,
      error: false,
    };
  }

  async createScrambledAttempt(data: CreateScrambledAttemptDto) {
    const result = await this.resultService.getResultOrCreate(
      data.personId,
      data.roundId,
    );

    return await this.prisma.attempt.create({
      data: {
        attemptNumber: data.attemptNumber,
        value: 0,
        penalty: 0,
        status: AttemptStatus.SCRAMBLED,
        scrambler: {
          connect: {
            id: data.scramblerId,
          },
        },
        scrambledAt: new Date(),
        type: data.isExtra
          ? AttemptType.EXTRA_ATTEMPT
          : AttemptType.STANDARD_ATTEMPT,
        result: {
          connect: {
            id: result.id,
          },
        },
      },
    });
  }

  async createOrUpdateScrambledAttempt(
    data: EnterAttemptDto,
    type: AttemptType,
    attemptNumber: number,
    finalData: any,
    device: Device,
    result: Result,
    judge?: Person,
    tx?: Tx,
  ) {
    const db = tx?.db ?? this.prisma;
    const scrambledAttempt = await db.attempt.findFirst({
      where: {
        resultId: result.id,
        attemptNumber: attemptNumber,
        type: type,
        status: AttemptStatus.SCRAMBLED,
      },
    });
    const newData = {
      attemptNumber: attemptNumber,
      sessionId: data.sessionId,
      status: data.isDelegate
        ? AttemptStatus.UNRESOLVED
        : AttemptStatus.STANDARD,
      type: type,
      solvedAt: data.solvedAt,
      penalty: finalData.penalty,
      value: finalData.value,
      originalTime: finalData.valueMs,
      inspectionTime: finalData.inspectionTime,
      judge: judge
        ? {
            connect: {
              id: judge.id,
            },
          }
        : undefined,
      device: {
        connect: {
          id: device.id,
        },
      },
      result: {
        connect: {
          id: result.id,
        },
      },
    };
    let attempt;
    if (scrambledAttempt) {
      attempt = await db.attempt.update({
        where: { id: scrambledAttempt.id },
        data: newData,
      });
    } else {
      attempt = await db.attempt.create({ data: newData });
    }
    await this.attemptEditLogService.log(
      attempt as AttemptSnapshot,
      attempt.solvedAt ?? new Date(),
      null,
      'Original entry',
      tx,
    );
    return attempt;
  }

  async createAnExtraAttemptAnReplaceTheOriginalOne(
    data: any,
    originalId: string,
    tx?: Tx,
  ) {
    const extraAttempt = await this.createOrUpdateScrambledAttempt(
      data,
      AttemptType.EXTRA_ATTEMPT,
      data.attemptNumber,
      data,
      data.device,
      data.result,
      data.judge,
      tx,
    );

    const attempt = await (tx?.db ?? this.prisma).attempt.update({
      where: { id: originalId },
      data: { replacedBy: extraAttempt.attemptNumber },
    });
    await this.attemptEditLogService.log(
      attempt as AttemptSnapshot,
      new Date(),
      null,
      `Replaced by extra ${extraAttempt.attemptNumber}`,
      tx,
    );
    return extraAttempt;
  }

  async updateResolvedIncident(
    attemptId: string,
    judgeCardId: string,
    locale: string,
    tx?: Tx,
  ) {
    await (tx?.db ?? this.prisma).attempt.update({
      where: {
        id: attemptId,
      },
      data: {
        judge: {
          connect: {
            cardId: judgeCardId,
          },
        },
      },
    });
    return {
      message: getTranslation('attemptEnteredAfterIncident', locale),
      status: 200,
      error: false,
    };
  }

  private enterResultToExternalService(resultId: string) {
    // Not awaited: the station shouldn't wait for an outside service
    this.resultService.sendResult(resultId).catch((e) => {
      this.logger.error('Error while sending the result');
      this.logger.error(e);
    });
  }

  private async dnsOtherAttempts(
    attemptNumber: number,
    maxAttempts: number,
    resultId: string,
    tx: Tx,
  ) {
    const now = new Date();
    for (let i = attemptNumber + 1; i <= maxAttempts; i++) {
      const created = await tx.db.attempt.create({
        data: {
          attemptNumber: i,
          status: AttemptStatus.STANDARD,
          type: AttemptType.STANDARD_ATTEMPT,
          penalty: DNS_VALUE,
          value: 0,
          solvedAt: now,
          result: { connect: { id: resultId } },
        },
      });
      await this.attemptEditLogService.log(
        created as AttemptSnapshot,
        now,
        null,
        'DNS auto-assigned',
        tx,
      );
    }
  }

  /** With no time left, nothing more can be solved: DNS whatever remains */
  private async dnsRemainingAttempts(
    resultId: string,
    maxAttempts: number,
    tx: Tx,
  ) {
    const attempts = await tx.db.attempt.findMany({
      where: { resultId, status: { not: AttemptStatus.SCRAMBLED } },
    });
    const now = new Date();
    let extraNumber = getNextExtraNumber(attempts) - 1;
    for (const original of getAttemptsWaitingForExtra(attempts)) {
      extraNumber++;
      const created = await tx.db.attempt.create({
        data: {
          attemptNumber: extraNumber,
          status: AttemptStatus.STANDARD,
          type: AttemptType.EXTRA_ATTEMPT,
          penalty: DNS_VALUE,
          value: 0,
          solvedAt: now,
          result: { connect: { id: resultId } },
        },
      });
      await this.attemptEditLogService.log(
        created as AttemptSnapshot,
        now,
        null,
        'DNS auto-assigned',
        tx,
      );
      const replaced = await tx.db.attempt.update({
        where: { id: original.id },
        data: { replacedBy: extraNumber },
      });
      await this.attemptEditLogService.log(
        replaced as AttemptSnapshot,
        now,
        null,
        `Replaced by extra ${extraNumber}`,
        tx,
      );
    }
    const lastAttempt = getSortedStandardAttempts(attempts).at(-1);
    await this.dnsOtherAttempts(
      lastAttempt?.attemptNumber ?? 0,
      maxAttempts,
      resultId,
      tx,
    );
  }

  /** The round's result once the competitor has no attempts left, else null */
  private async getFinishedRoundResultText(
    resultId: string,
    roundInfo: any,
    tx: Tx,
  ) {
    const attempts = await tx.db.attempt.findMany({
      where: { resultId },
    });
    const countingAttempts = getCountingAttempts(attempts);
    const cutoffAttempts = roundInfo.cutoff?.numberOfAttempts;
    const stoppedAtCutoff =
      cutoffAttempts &&
      countingAttempts.length === cutoffAttempts &&
      !checkCutoff(
        countingAttempts,
        roundInfo.cutoff.resultValue,
        cutoffAttempts,
      );
    const isFinished =
      stoppedAtCutoff ||
      countingAttempts.length === getMaxAttempts(roundInfo.format);
    return isFinished
      ? getRoundResultText(countingAttempts, roundInfo.format)
      : null;
  }

  private notifyDelegate(
    deviceName: string,
    competitorName: string,
    locale: string,
    attemptId: string,
    tx: Tx,
  ) {
    tx.afterCommit(() =>
      this.appGateway.handleNewIncident(deviceName, competitorName, attemptId),
    );
    return {
      message: getTranslation('delegateWasNotified', locale),
      status: 200,
      error: false,
    };
  }

  private async getValidatedData(
    personId: string,
    wcifRoundInfo: any,
    newAttemptData: any,
  ) {
    const submittedAttempts = await this.resultService.getSubmittedAttempts(
      wcifRoundInfo.id,
      personId,
    );
    const dataToReturn: any = newAttemptData;
    let limitPassed = true;
    let cutoffPassed = true;

    if (wcifRoundInfo.timeLimit.cumulativeRoundIds.length > 0) {
      if (
        !(await this.resultService.checkCumulativeLimit(
          personId,
          wcifRoundInfo.timeLimit,
          [...submittedAttempts, newAttemptData],
        ))
      ) {
        limitPassed = false;
        dataToReturn.penalty = -1;
        dataToReturn.dnsOther = true;
      }
    }
    if (wcifRoundInfo.timeLimit.centiseconds > 0) {
      if (
        !checkAttemptLimit(
          newAttemptData.value,
          wcifRoundInfo.timeLimit.centiseconds,
        )
      ) {
        limitPassed = false;
        dataToReturn.penalty = -1;
      }
    }
    if (wcifRoundInfo.cutoff) {
      if (
        !checkCutoff(
          submittedAttempts,
          wcifRoundInfo.cutoff.resultValue,
          wcifRoundInfo.cutoff.numberOfAttempts,
        )
      ) {
        cutoffPassed = false;
        dataToReturn.penalty = 0;
      }
    }

    return {
      ...dataToReturn,
      limitPassed: limitPassed,
      cutoffPassed: cutoffPassed,
      attemptNumber: submittedAttempts.length + 1,
    };
  }
}
