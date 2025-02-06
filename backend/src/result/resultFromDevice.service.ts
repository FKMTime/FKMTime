import { forwardRef, HttpException, Inject, Logger } from '@nestjs/common';
import {
  AttemptStatus,
  AttemptType,
  Competition,
  Device,
  DeviceType,
  Person,
  Result,
  SendingResultsFrequency,
} from '@prisma/client';
import { AppGateway } from 'src/app.gateway';
import { AttendanceService } from 'src/attendance/attendance.service';
import { DNS_VALUE } from 'src/constants';
import { ContestsService } from 'src/contests/contests.service';
import { DbService } from 'src/db/db.service';
import { DeviceService } from 'src/device/device.service';
import { isUnofficialEvent } from 'src/events';
import { PersonService } from 'src/person/person.service';
import { CreateScrambledAttemptDto } from 'src/scrambling/dto/createScrambledAttempt.dto';
import { getTranslation, isLocaleAvailable } from 'src/translations';
import { WcaService } from 'src/wca/wca.service';
import { getPersonFromWcif, getRoundInfoFromWcif } from 'wcif-helpers';

import { EnterAttemptDto } from './dto/enterAttempt.dto';
import {
  checkAttemptLimit,
  checkCutoff,
  getSortedExtraAttempts,
  getSortedStandardAttempts,
  isCompetitorSignedInForEvent,
} from './helpers';
import { ResultService } from './result.service';

export class ResultFromDeviceService {
  constructor(
    private readonly prisma: DbService,
    private readonly appGateway: AppGateway,
    private readonly attendanceService: AttendanceService,
    private readonly wcaService: WcaService,
    private readonly contestsService: ContestsService,
    @Inject(forwardRef(() => DeviceService))
    private readonly deviceService: DeviceService,
    private readonly personService: PersonService,
    private readonly resultService: ResultService,
  ) {}

  private logger = new Logger('ResultFromDeviceService');

  async getStationByEspId(espId: number) {
    return await this.deviceService.getDeviceByEspId(espId, DeviceType.STATION);
  }

  async enterAttempt(data: EnterAttemptDto) {
    const device = await this.getStationByEspId(data.espId);
    if (!device) {
      return {
        message: getTranslation('stationNotFound', 'en'),
        shouldResetTime: false,
        status: 404,
        error: true,
      };
    }
    if (device.room.currentGroupIds.length === 0) {
      return {
        message: 'No group in this room',
        status: 400,
        shouldResetTime: false,
        error: true,
      };
    }
    let groupId = '';

    if (device.room.currentGroupIds.length === 1) {
      groupId = device.room.currentGroupIds[0];
    } else if (device.room.currentGroupIds.length > 1 && !data.groupId) {
      return {
        message: getTranslation('groupNotFound', 'en'),
        shouldResetTime: false,
        status: 400,
        error: true,
      };
    } else if (device.room.currentGroupIds.length > 1 && data.groupId) {
      if (!device.room.currentGroupIds.includes(data.groupId)) {
        return {
          message: getTranslation('groupNotFound', 'en'),
          shouldResetTime: false,
          status: 404,
          error: true,
        };
      }
      groupId = data.groupId;
    }

    const competitor = await this.personService.getPersonByCardId(
      data.competitorId.toString(),
    );
    let locale = 'PL';
    if (!competitor) {
      return {
        message: getTranslation('competitorNotFound', locale),
        shouldResetTime: true,
        status: 404,
        error: true,
      };
    }
    await this.attendanceService.markCompetitorAsPresent(
      competitor.id,
      groupId,
      device.id,
    );
    locale = competitor.countryIso2;

    const previousAttemptWithSameSessionId =
      await this.prisma.attempt.findFirst({
        where: {
          sessionId: data.sessionId,
          deviceId: device.id,
        },
      });
    if (previousAttemptWithSameSessionId) {
      if (previousAttemptWithSameSessionId.status === AttemptStatus.RESOLVED) {
        if (data.judgeId) {
          return this.updateResolvedIncident(
            previousAttemptWithSameSessionId.id,
            data.judgeId.toString(),
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
      return {
        message: getTranslation('attemptAlreadyEntered', locale),
        shouldResetTime: false,
        status: 400,
        error: true,
      };
    }

    const judge = await this.personService.getPersonByCardId(
      data.judgeId.toString(),
    );

    if (!judge && !data.isDelegate) {
      return {
        message: getTranslation('judgeNotFound', locale),
        shouldResetTime: false,
        status: 404,
        error: true,
      };
    }
    if (judge) {
      await this.attendanceService.markJudgeAsPresent(
        judge.id,
        groupId,
        device.id,
      );
      if (judge.countryIso2 === competitor.countryIso2) {
        if (isLocaleAvailable(judge.countryIso2.toLowerCase())) {
          locale = judge.countryIso2.toLowerCase();
        }
      } else {
        locale = 'en';
      }
    }

    const competition = await this.prisma.competition.findFirst();
    if (!competition) {
      return {
        message: getTranslation('competitionNotFound', locale),
        shouldResetTime: true,
        status: 404,
        error: true,
      };
    }
    const wcif = JSON.parse(JSON.stringify(competition.wcif));
    const currentRoundId = groupId.split('-g')[0];
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
    const result = await this.resultService.getResultOrCreate(
      competitor.id,
      currentRoundId,
    );

    const attempts = await this.prisma.attempt.findMany({
      where: {
        resultId: result.id,
        status: {
          not: AttemptStatus.SCRAMBLED,
        },
      },
    });

    const finalData = await this.getValidatedData(roundInfo, attempts, data);

    if (!finalData.cutoffPassed) {
      return {
        message: getTranslation('cutoffNotPassed', locale),
        shouldResetTime: true,
        status: 400,
        error: true,
      };
    }
    const sortedAttempts = getSortedStandardAttempts(attempts);
    const sortedExtraAttempts = getSortedExtraAttempts(attempts);

    const lastExtra =
      sortedExtraAttempts.length > 0 ? sortedExtraAttempts.length : 0;
    let extraEntered = false;
    if (
      attempts.some(
        (attempt) =>
          attempt.status === AttemptStatus.EXTRA_GIVEN &&
          (attempt.replacedBy === 0 || attempt.replacedBy === null),
      )
    ) {
      const lastAttemptToReplace = attempts.find(
        (attempt) =>
          attempt.status === AttemptStatus.EXTRA_GIVEN &&
          (attempt.replacedBy === 0 || attempt.replacedBy === null),
      );
      await this.createAnExtraAttemptAnReplaceTheOriginalOne(
        {
          ...finalData,
          device,
          judge,
          competitor,
          result,
          attemptNumber: lastExtra + 1,
        },
        lastAttemptToReplace.id,
      );
      extraEntered = true;
      if (data.isDelegate) {
        return this.notifyDelegate(
          device.name,
          competitor.name,
          locale,
          lastAttemptToReplace.id,
        );
      }
    }
    if (!extraEntered) {
      let attemptNumber = 1;
      const maxAttempts = roundInfo.format === 'a' ? 5 : 3;
      let lastAttempt = sortedAttempts[sortedAttempts.length - 1];
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
      );
      if (!lastAttempt) {
        lastAttempt = attempt;
      }
      if (data.isDelegate) {
        return this.notifyDelegate(
          device.name,
          competitor.name,
          locale,
          lastAttempt.id,
        );
      }
      if (finalData.dnsOther) {
        await this.dnsOtherAttempts(attemptNumber, maxAttempts, result.id);
      }
    }
    if (
      competition.sendingResultsFrequency ===
      SendingResultsFrequency.AFTER_SOLVE
    ) {
      await this.enterResultToExternalService(
        result.id,
        competition,
        currentRoundId,
      );
    }
    this.appGateway.handleResultEntered(result.roundId);
    return {
      message: finalData.limitPassed
        ? getTranslation('attemptEntered', locale)
        : getTranslation('attemptEnteredButReplacedToDnf', locale),
      shouldResetTime: true,
      status: 200,
      error: false,
    };
  }

  async getScrambleData(cardId: string, roundId: string) {
    const competitor = await this.personService.getPersonByCardId(cardId);
    if (!competitor) {
      throw new HttpException('Competitor not found', 404);
    }
    const result = await this.resultService.getResultOrCreate(
      competitor.id,
      roundId,
    );
    const attempts = await this.prisma.attempt.findMany({
      where: {
        resultId: result.id,
      },
    });
    const sortedAttempts = getSortedStandardAttempts(attempts);
    const sortedExtraAttempts = getSortedExtraAttempts(attempts);
    if (sortedAttempts.length === 0 && sortedExtraAttempts.length === 0) {
      return {
        scrambleData: {
          num: 1,
          isExtra: false,
        },
        person: competitor,
      };
    }
    if (
      attempts.some(
        (attempt) =>
          attempt.status === AttemptStatus.EXTRA_GIVEN &&
          (attempt.replacedBy === 0 || attempt.replacedBy === null),
      )
    ) {
      const extrasCount = sortedExtraAttempts.length;
      return {
        scrambleData: {
          num: extrasCount + 1,
          isExtra: true,
        },
        person: competitor,
      };
    }
    const competition = await this.prisma.competition.findFirst();
    if (!competition) {
      throw new Error('Competition not found');
    }
    const wcif = JSON.parse(JSON.stringify(competition.wcif));
    const currentRoundId = roundId.split('-g')[0];
    const roundInfo = getRoundInfoFromWcif(currentRoundId, wcif);

    let attemptNumber = 1;
    const maxAttempts = roundInfo.format === 'a' ? 5 : 3;
    const lastAttempt = sortedAttempts[sortedAttempts.length - 1];
    if (lastAttempt && lastAttempt.attemptNumber === maxAttempts) {
      //No attempts left
      return {
        scrambleData: {
          num: -1,
          isExtra: false,
        },
        person: competitor,
      };
    }
    if (lastAttempt) {
      attemptNumber = lastAttempt.attemptNumber + 1;
    }
    return {
      scrambleData: {
        num: attemptNumber,
        isExtra: false,
      },
      person: competitor,
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
  ) {
    const scrambledAttempt = await this.prisma.attempt.findFirst({
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
    if (scrambledAttempt) {
      return await this.prisma.attempt.update({
        where: {
          id: scrambledAttempt.id,
        },
        data: newData,
      });
    } else {
      return await this.prisma.attempt.create({
        data: newData,
      });
    }
  }

  async createAnExtraAttemptAnReplaceTheOriginalOne(
    data: any,
    originalId: string,
  ) {
    const extraAttempt = await this.createOrUpdateScrambledAttempt(
      data,
      AttemptType.EXTRA_ATTEMPT,
      data.attemptNumber,
      data,
      data.device,
      data.result,
      data.judge,
    );

    const attempt = await this.prisma.attempt.update({
      where: {
        id: originalId,
      },
      data: {
        replacedBy: extraAttempt.attemptNumber,
      },
    });
    return attempt.attemptNumber;
  }

  async updateResolvedIncident(attemptId: string, judgeCardId: string) {
    await this.prisma.attempt.update({
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
      message: 'Attempt updated',
      status: 200,
      error: false,
    };
  }

  private async enterResultToExternalService(
    resultId: string,
    competition: Competition,
    currentRoundId: string,
  ) {
    const resultToEnter = await this.resultService.getResultById(resultId);
    if (isUnofficialEvent(currentRoundId.split('-')[0])) {
      if (competition.cubingContestsToken) {
        //This is intentionally not awaited
        this.contestsService.enterWholeScorecardToCubingContests(resultToEnter);
      }
    } else {
      try {
        //This is intentionally not awaited
        this.wcaService.enterWholeScorecardToWcaLive(resultToEnter);
      } catch (e) {
        this.logger.error('Error while entering result to WCA Live');
        this.logger.error(e);
      }
    }
  }

  private async dnsOtherAttempts(
    attemptNumber: number,
    maxAttempts: number,
    resultId: string,
  ) {
    for (let i = attemptNumber + 1; i <= maxAttempts; i++) {
      await this.prisma.attempt.create({
        data: {
          attemptNumber: attemptNumber + i + 1,
          status: AttemptStatus.STANDARD,
          type: AttemptType.STANDARD_ATTEMPT,
          penalty: DNS_VALUE,
          value: 0,
          result: {
            connect: {
              id: resultId,
            },
          },
        },
      });
    }
  }

  private notifyDelegate(
    deviceName: string,
    competitorName: string,
    locale: string,
    attemptId: string,
  ) {
    this.appGateway.handleNewIncident(deviceName, competitorName, attemptId);
    return {
      message: getTranslation('delegateWasNotified', locale),
      status: 200,
      error: false,
    };
  }

  private async getValidatedData(
    wcifRoundInfo: any,
    attempts: any[],
    newAttemptData: any,
  ) {
    const submittedAttempts = [];
    const dataToReturn: any = newAttemptData;
    let limitPassed = true;
    let cutoffPassed = true;
    attempts.forEach((attempt) => {
      if (
        attempt.replacedBy === null &&
        attempt.type === AttemptType.STANDARD_ATTEMPT &&
        !submittedAttempts.some((a) => a.id === attempt.id) &&
        attempt.status === AttemptStatus.STANDARD
      ) {
        submittedAttempts.push(attempt);
      } else if (
        attempt.replacedBy !== null &&
        attempt.status === AttemptStatus.EXTRA_GIVEN
      ) {
        const extraAttempt = this.wcaService.getExtra(attempt.id, attempts);
        if (
          extraAttempt &&
          !submittedAttempts.some((a) => a.id === extraAttempt.id) &&
          extraAttempt.status === AttemptStatus.STANDARD
        ) {
          submittedAttempts.push(extraAttempt);
        }
      }
    });

    if (wcifRoundInfo.timeLimit.cumulativeRoundIds.length > 0) {
      if (
        !(await this.checkCumulativeLimit(wcifRoundInfo.timeLimit, [
          ...submittedAttempts,
          newAttemptData,
        ]))
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
          wcifRoundInfo.cutoff.attemptResult,
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

  private async checkCumulativeLimit(limit: any, submittedAttempts: any[]) {
    if (limit.cumulativeRoundIds.length === 0) return true;
    if (limit.cumulativeRoundIds.length === 1) {
      let sum = 0;
      submittedAttempts.forEach((attempt) => {
        if (attempt.penalty !== -1) {
          sum += attempt.value + attempt.penalty * 100;
        } else {
          sum += attempt.value;
        }
      });
      return sum < limit.centiseconds;
    }
    if (limit.cumulativeRoundIds.length > 1) {
      return await this.checkCumulativeLimitForMultipleRounds(
        limit.cumulativeRoundIds,
        limit.centiseconds,
      );
    }
  }

  private async checkCumulativeLimitForMultipleRounds(
    roundsIds: string[],
    limit: number,
  ) {
    const attempts = await this.prisma.attempt.findMany({
      where: {
        result: {
          roundId: {
            in: roundsIds,
          },
        },
      },
    });
    let sum = 0;
    attempts.forEach((attempt) => {
      if (attempt.penalty !== -1) {
        sum += attempt.value + attempt.penalty * 100;
      } else {
        sum += attempt.value;
      }
    });
    return sum < limit;
  }
}
