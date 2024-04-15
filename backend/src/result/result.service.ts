import { HttpException, Injectable } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import { EnterAttemptDto } from './dto/enterAttempt.dto';
import { getTranslation, isLocaleAvailable } from 'src/translations';
import { Event, Person, Round } from '@wca/helpers';
import { AttemptStatus, DeviceType } from '@prisma/client';
import { IncidentsGateway } from '../attempt/incidents.gateway';
import { ResultGateway } from './result.gateway';
import {
  checkAttemptLimit,
  checkCutoff,
  getSortedExtraAttempts,
  getSortedStandardAttempts,
  isCompetitorSignedInForEvent,
} from './helpers';
import { AttendanceService } from '../attendance/attendance.service';
import { WcaService } from '../wca/wca.service';
import { DeviceService } from '../device/device.service';
import { PersonService } from '../person/person.service';

@Injectable()
export class ResultService {
  constructor(
    private readonly prisma: DbService,
    private readonly incidentsGateway: IncidentsGateway,
    private readonly resultGateway: ResultGateway,
    private readonly attendanceService: AttendanceService,
    private readonly wcaService: WcaService,
    private readonly deviceService: DeviceService,
    private readonly personService: PersonService,
  ) {}

  async getAllResultsByRound(roundId: string, search?: string) {
    const whereParams = {
      roundId: roundId,
    };

    if (search) {
      whereParams['OR'] = [
        {
          person: {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
        {
          person: {
            wcaId: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
      ];
      if (!isNaN(parseInt(search))) {
        whereParams['OR'].push({
          person: {
            registrantId: parseInt(search),
          },
        });
      }
    }
    return this.prisma.result.findMany({
      where: whereParams,
      orderBy: {
        updatedAt: 'desc',
      },
      include: {
        person: {
          select: {
            id: true,
            name: true,
            wcaId: true,
            registrantId: true,
          },
        },
        attempts: {
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
          },
        },
      },
    });
  }

  async getAllResultsByPerson(personId: string) {
    return this.prisma.result.findMany({
      where: {
        personId: personId,
      },
      include: {
        person: {
          select: {
            id: true,
            name: true,
            wcaId: true,
            registrantId: true,
          },
        },
        attempts: {
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
          },
        },
      },
    });
  }

  async getResultById(id: string) {
    const result = await this.prisma.result.findUnique({
      where: {
        id: id,
      },
      include: {
        person: {
          select: {
            id: true,
            name: true,
            wcaId: true,
            registrantId: true,
            countryIso2: true,
          },
        },
        attempts: {
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
          },
        },
      },
    });
    if (!result) {
      throw new HttpException('Result not found', 404);
    }
    return result;
  }

  async enterWholeScorecardToWcaLive(resultId: string) {
    const result = await this.getResultById(resultId);
    return await this.wcaService.enterWholeScorecardToWcaLive(result);
  }

  async enterRoundToWcaLive(roundId: string) {
    const results = await this.getAllResultsByRound(roundId);
    return await this.wcaService.enterRoundToWcaLive(results);
  }

  async getStationByEspIdOrThrow(espId: number) {
    const station = await this.deviceService.getDeviceByEspId(
      espId,
      DeviceType.STATION,
    );
    if (!station) {
      throw new HttpException('Station not found', 404);
    }
    if (!station.room.currentGroupId) {
      throw new HttpException(
        {
          message: 'No group in this room',
          shouldResetTime: false,
        },
        400,
      );
    }
    return station;
  }

  async getResultOrCreate(personId: string, roundId: string) {
    return this.prisma.result.upsert({
      where: {
        personId_roundId: {
          personId: personId,
          roundId: roundId,
        },
      },
      update: {},
      create: {
        person: {
          connect: {
            id: personId,
          },
        },
        eventId: roundId.split('-')[0],
        roundId: roundId,
      },
      include: {
        person: true,
        attempts: {
          include: {
            judge: true,
            device: true,
          },
        },
      },
    });
  }

  async enterAttempt(data: EnterAttemptDto) {
    const device = await this.getStationByEspIdOrThrow(data.espId);
    const competitor = await this.personService.getPersonByCardId(
      data.competitorId.toString(),
    );
    let locale = 'PL';
    if (!competitor) {
      throw new HttpException(
        {
          message: getTranslation('competitorNotFound', locale),
          shouldResetTime: true,
        },
        404,
      );
    }
    locale = competitor.countryIso2;

    const previousAttemptWithSameSessionId =
      await this.prisma.attempt.findFirst({
        where: {
          sessionId: data.sessionId,
          deviceId: device.id,
        },
      });
    if (previousAttemptWithSameSessionId) {
      throw new HttpException(
        {
          message: getTranslation('attemptAlreadyEntered', locale),
          shouldResetTime: false,
        },
        400,
      );
    }

    const judge = await this.personService.getPersonByCardId(
      data.judgeId.toString(),
    );

    if (!judge && !data.isDelegate) {
      throw new HttpException(
        {
          message: getTranslation('judgeNotFound', locale),
          shouldResetTime: false,
        },
        404,
      );
    }
    if (judge) {
      await this.attendanceService.markJudgeAsPresent(
        judge.id,
        device.room.currentGroupId,
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
      throw new HttpException(
        {
          message: getTranslation('competitionNotFound', locale),
          shouldResetTime: true,
        },
        404,
      );
    }
    const wcif = JSON.parse(JSON.stringify(competition.wcif));
    const currentRoundId = device.room.currentGroupId.split('-g')[0];
    const eventInfo = wcif.events.find(
      (event: Event) => event.id === currentRoundId.split('-')[0],
    );
    const roundInfo = eventInfo.rounds.find(
      (round: Round) => round.id === currentRoundId,
    );
    const competitorWcifInfo = wcif.persons.find(
      (person: Person) => person.registrantId === competitor.registrantId,
    );
    const competitorSignedInForEvent = isCompetitorSignedInForEvent(
      competitorWcifInfo,
      currentRoundId.split('-')[0],
    );
    if (!competitorSignedInForEvent) {
      throw new HttpException(
        {
          message: getTranslation('competitorIsNotSignedInForEvent', locale),
          shouldResetTime: false,
        },
        400,
      );
    }
    const result = await this.getResultOrCreate(competitor.id, currentRoundId);

    const attempts = await this.prisma.attempt.findMany({
      where: {
        resultId: result.id,
      },
    });

    const finalData = await this.getValidatedData(roundInfo, attempts, data);

    if (!finalData.cutoffPassed) {
      throw new HttpException(
        {
          message: getTranslation('cutoffNotPassed', locale),
          shouldResetTime: true,
        },
        400,
      );
    }
    const sortedAttempts = getSortedStandardAttempts(attempts);
    const sortedExtraAttempts = getSortedExtraAttempts(attempts);

    const lastExtra =
      sortedExtraAttempts.length > 0 ? sortedExtraAttempts.length : 0;
    let attemptToEnterToWcaLive: any = {};

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
          (attempt.replacedBy === 0 || attempt.replacedBy === null) &&
          attempt.shouldBeUsed === true,
      );
      if (data.isDelegate) {
        await this.createAnUnusedExtraAttempt({
          ...finalData,
          device,
          judge,
          competitor,
          result,
          attemptNumber: lastExtra + 1,
        });
        return this.notifyDelegate(
          device.name,
          competitor.name,
          locale,
          lastAttemptToReplace.id,
        );
      }
      const attemptNumber =
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
      attemptToEnterToWcaLive = {
        wcaId: competition.wcaId,
        scoretakingToken: competition.scoretakingToken,
        eventId: currentRoundId.split('-')[0],
        roundNumber: parseInt(currentRoundId.split('-r')[1]),
        registrantId: competitor.registrantId,
        attemptNumber: attemptNumber,
        attemptResult: finalData.timeToEnter,
      };
    }
    let attemptNumber = 1;
    const maxAttempts = roundInfo.format === 'a' ? 5 : 3;
    if (!attemptToEnterToWcaLive.registrantId) {
      const lastAttempt = sortedAttempts[sortedAttempts.length - 1];
      if (lastAttempt && lastAttempt.attemptNumber === maxAttempts) {
        throw new HttpException(
          {
            message: getTranslation('noAttemptsLeft', locale),
            shouldResetTime: true,
          },
          400,
        );
      }
      if (lastAttempt) {
        attemptNumber = lastAttempt.attemptNumber + 1;
      }
      await this.prisma.attempt.create({
        data: {
          attemptNumber: attemptNumber,
          sessionId: data.sessionId,
          status: data.isDelegate
            ? AttemptStatus.UNRESOLVED
            : AttemptStatus.STANDARD_ATTEMPT,
          solvedAt: data.solvedAt,
          penalty: finalData.penalty,
          value: finalData.value,
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
        },
      });
      if (data.isDelegate) {
        return this.notifyDelegate(
          device.name,
          competitor.name,
          locale,
          lastAttempt.id,
        );
      }
      attemptToEnterToWcaLive = {
        wcaId: competition.wcaId,
        scoretakingToken: competition.scoretakingToken,
        eventId: currentRoundId.split('-')[0],
        roundNumber: parseInt(currentRoundId.split('-r')[1]),
        registrantId: competitor.registrantId,
        attemptNumber: attemptNumber,
        attemptResult: finalData.timeToEnter,
      };
    }
    if (competition.sendResultsToWcaLive) {
      await this.wcaService.enterAttemptToWcaLive(
        attemptToEnterToWcaLive.wcaId,
        attemptToEnterToWcaLive.scoretakingToken,
        attemptToEnterToWcaLive.eventId,
        attemptToEnterToWcaLive.roundNumber,
        attemptToEnterToWcaLive.registrantId,
        attemptToEnterToWcaLive.attemptNumber,
        attemptToEnterToWcaLive.attemptResult,
      );
    }
    if (finalData.dnsOther) {
      for (let i = 0; i < maxAttempts - attemptNumber; i++) {
        await this.prisma.attempt.create({
          data: {
            attemptNumber: attemptNumber + i + 1,
            status: AttemptStatus.STANDARD_ATTEMPT,
            penalty: -2,
            value: 0,
            result: {
              connect: {
                id: result.id,
              },
            },
          },
        });
      }
      if (competition.sendResultsToWcaLive) {
        await this.wcaService.enterWholeScorecardToWcaLive(result.id);
      }
    }
    this.resultGateway.handleResultEntered(result.roundId);
    return {
      message: finalData.limitPassed
        ? getTranslation('attemptEntered', locale)
        : getTranslation('attemptEnteredButReplacedToDnf', locale),
    };
  }

  async createAnUnusedExtraAttempt(data: any) {
    await this.prisma.attempt.create({
      data: {
        attemptNumber: data.attemptNumber,
        sessionId: data.sessionId,
        inspectionTime: data.inspectionTime,
        solvedAt: data.solvedAt,
        status: AttemptStatus.UNRESOLVED,
        shouldBeUsed: false,
        penalty: data.penalty,
        value: data.value,
        judge: data.judge
          ? {
              connect: {
                id: data.judge.id,
              },
            }
          : undefined,
        device: {
          connect: {
            id: data.device.id,
          },
        },
        result: {
          connect: {
            id: data.result.id,
          },
        },
      },
    });
  }

  async createAnExtraAttemptAnReplaceTheOriginalOne(
    data: any,
    originalId: string,
  ) {
    const extraAttempt = await this.prisma.attempt.create({
      data: {
        attemptNumber: data.attemptNumber,
        sessionId: data.sessionId,
        inspectionTime: data.inspectionTime,
        solvedAt: data.solvedAt,
        status: AttemptStatus.EXTRA_ATTEMPT,
        penalty: data.penalty,
        value: data.value,
        judge: data.judge
          ? {
              connect: {
                id: data.judge.id,
              },
            }
          : undefined,
        device: {
          connect: {
            id: data.device.id,
          },
        },
        result: {
          connect: {
            id: data.result.id,
          },
        },
      },
    });

    if (!data.isDelegate) {
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
    return -1;
  }

  private notifyDelegate(
    deviceName: string,
    competitorName: string,
    locale: string,
    attemptId: string,
  ) {
    this.incidentsGateway.handleNewIncident(
      deviceName,
      competitorName,
      attemptId,
    );
    return {
      message: getTranslation('delegateWasNotified', locale),
      shouldResetTime: true,
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
        attempt.status !== AttemptStatus.EXTRA_ATTEMPT &&
        !submittedAttempts.some((a) => a.id === attempt.id) &&
        attempt.status !== AttemptStatus.EXTRA_GIVEN &&
        attempt.status !== AttemptStatus.UNRESOLVED
      )
        submittedAttempts.push(attempt);
      if (
        attempt.replacedBy !== null &&
        attempt.status === AttemptStatus.EXTRA_GIVEN
      ) {
        const extraAttempt = attempts.find(
          (a) =>
            a.attemptNumber === attempt.replacedBy &&
            a.status === AttemptStatus.EXTRA_ATTEMPT,
        );
        if (
          extraAttempt &&
          !submittedAttempts.some((a) => a.id === extraAttempt.id)
        ) {
          submittedAttempts.push(extraAttempt);
        }
      }
    });
    let timeToEnterToWcaLive: any = null;

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
        timeToEnterToWcaLive = -1;
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
        timeToEnterToWcaLive = -1;
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
        timeToEnterToWcaLive = 0;
        dataToReturn.penalty = 0;
      }
    }

    return {
      ...dataToReturn,
      timeToEnter: timeToEnterToWcaLive
        ? timeToEnterToWcaLive
        : newAttemptData.penalty === -1
          ? -1
          : newAttemptData.penalty * 100 + newAttemptData.value,
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
