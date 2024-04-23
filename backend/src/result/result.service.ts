import { Injectable } from '@nestjs/common';
import { AttemptStatus, AttemptType, DeviceType } from '@prisma/client';
import { Event, Person, Round } from '@wca/helpers';
import { DbService } from 'src/db/db.service';
import { getTranslation, isLocaleAvailable } from 'src/translations';
import { IncidentsGateway } from '../attempt/incidents.gateway';
import { AttendanceService } from '../attendance/attendance.service';
import { DeviceService } from '../device/device.service';
import { PersonService } from '../person/person.service';
import { WcaService } from '../wca/wca.service';
import { EnterAttemptDto } from './dto/enterAttempt.dto';
import {
  checkAttemptLimit,
  checkCutoff,
  getSortedExtraAttempts,
  getSortedStandardAttempts,
  isCompetitorSignedInForEvent,
} from './helpers';
import { ResultGateway } from './result.gateway';

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

  async deleteResultById(id: string) {
    return this.prisma.result.delete({
      where: {
        id: id,
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
      return {
        message: 'Result not found',
        status: 404,
        error: true,
      };
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

  async getStationByEspId(espId: number) {
    return await this.deviceService.getDeviceByEspId(espId, DeviceType.STATION);
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
    const device = await this.getStationByEspId(data.espId);
    if (!device) {
      return {
        message: 'Device not found',
        shouldResetTime: false,
        status: 404,
        error: true,
      };
    }
    if (!device.room.currentGroupId) {
      return {
        message: 'No group in this room',
        status: 400,
        shouldResetTime: false,
        error: true,
      };
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
    locale = competitor.countryIso2;

    const previousAttemptWithSameSessionId =
      await this.prisma.attempt.findFirst({
        where: {
          sessionId: data.sessionId,
          deviceId: device.id,
        },
      });
    if (previousAttemptWithSameSessionId) {
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
      return {
        message: getTranslation('competitionNotFound', locale),
        shouldResetTime: true,
        status: 404,
        error: true,
      };
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
      return {
        message: getTranslation('competitorIsNotSignedInForEvent', locale),
        shouldResetTime: false,
        status: 400,
        error: true,
      };
    }
    const result = await this.getResultOrCreate(competitor.id, currentRoundId);

    const attempts = await this.prisma.attempt.findMany({
      where: {
        resultId: result.id,
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
      const lastAttempt = sortedAttempts[sortedAttempts.length - 1];
      if (lastAttempt && lastAttempt.attemptNumber === maxAttempts) {
        return {
          message: getTranslation('noAttemptsLeft', locale),
          shouldResetTime: true,
          status: 400,
          error: true,
        };
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
            : AttemptStatus.STANDARD,
          type: AttemptType.STANDARD_ATTEMPT,
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
      if (finalData.dnsOther) {
        for (let i = 0; i < maxAttempts - attemptNumber; i++) {
          await this.prisma.attempt.create({
            data: {
              attemptNumber: attemptNumber + i + 1,
              status: AttemptStatus.STANDARD,
              type: AttemptType.STANDARD_ATTEMPT,
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
      }
    }
    if (competition.sendResultsToWcaLive) {
      try {
        const resultToEnter = await this.getResultById(result.id);
        try {
          await this.wcaService.enterWholeScorecardToWcaLive(resultToEnter);
        } catch (e) {
          console.log(e);
        }
      } catch (e) {
        console.log(e);
      }
    }
    this.resultGateway.handleResultEntered(result.roundId);
    return {
      message: finalData.limitPassed
        ? getTranslation('attemptEntered', locale)
        : getTranslation('attemptEnteredButReplacedToDnf', locale),
      shouldResetTime: true,
      status: 200,
      error: false,
    };
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
        status: data.isDelegate
          ? AttemptStatus.UNRESOLVED
          : AttemptStatus.STANDARD,
        type: AttemptType.EXTRA_ATTEMPT,
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
      status: 200,
      error: true,
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
