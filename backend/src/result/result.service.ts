import { HttpException, Injectable } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import { EnterAttemptDto } from './dto/enterAttempt.dto';
import Expo from 'expo-server-sdk';
import { en, pl } from 'src/translations';

const WCA_LIVE_API_ORIGIN = process.env.WCA_LIVE_API_ORIGIN;
const WCA_LIVE_DEV_API_ORIGIN = process.env.WCA_LIVE_DEV_API_ORIGIN;

@Injectable()
export class ResultService {
  constructor(private readonly prisma: DbService) {}

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
            },
          },
        },
        {
          person: {
            wcaId: {
              contains: search,
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
    const results = await this.prisma.result.findMany({
      where: whereParams,
      select: {
        id: true,
        eventId: true,
        roundId: true,
        createdAt: true,
        updatedAt: true,
        person: {
          select: {
            id: true,
            registrantId: true,
            gender: true,
            name: true,
            wcaId: true,
          },
        },
        Attempt: {
          select: {
            id: true,
            resultId: true,
            attemptNumber: true,
            replacedBy: true,
            isDelegate: true,
            isResolved: true,
            penalty: true,
            isExtraAttempt: true,
            extraGiven: true,
            value: true,
            solvedAt: true,
            createdAt: true,
            judge: {
              select: {
                id: true,
                registrantId: true,
                gender: true,
                name: true,
              },
            },
            station: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
    return results.map((result) => {
      return {
        ...result,
        person: {
          id: result.person.id,
          name: result.person.name,
          registrantId: result.person.registrantId,
          gender: result.person.registrantId,
          wcaId: result.person.wcaId,
        },
        attempts: result.Attempt.map((attempt) => {
          return {
            ...attempt,
            solvedAt: attempt.solvedAt ? attempt.solvedAt : attempt.createdAt,
            judge: attempt.judge && {
              id: attempt.judge.id,
              name: attempt.judge.name,
              registrantId: attempt.judge.registrantId,
              gender: attempt.judge.gender,
            },
            station: attempt.station && {
              id: attempt.station.id,
              name: attempt.station.name,
            },
          };
        }),
        Attempt: undefined,
      };
    });
  }

  async getAllResultsByPerson(personId: string) {
    const results = await this.prisma.result.findMany({
      where: {
        personId: personId,
      },
      select: {
        id: true,
        eventId: true,
        roundId: true,
        createdAt: true,
        updatedAt: true,
        person: {
          select: {
            id: true,
            name: true,
          },
        },
        Attempt: {
          select: {
            id: true,
            attemptNumber: true,
            replacedBy: true,
            isDelegate: true,
            isResolved: true,
            penalty: true,
            solvedAt: true,
            createdAt: true,
            isExtraAttempt: true,
            extraGiven: true,
            value: true,
            judge: {
              select: {
                id: true,
                name: true,
              },
            },
            station: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
    return results.map((result) => {
      return {
        ...result,
        person: {
          id: result.person.id,
          name: result.person.name,
        },
        attempts: result.Attempt.map((attempt) => {
          return {
            ...attempt,
            solvedAt: attempt.solvedAt ? attempt.solvedAt : attempt.createdAt,
            judge: attempt.judge && {
              id: attempt.judge.id,
              name: attempt.judge.name,
            },
            station: attempt.station && {
              id: attempt.station.id,
              name: attempt.station.name,
            },
          };
        }),
      };
    });
  }

  async getResultById(id: string) {
    const result = await this.prisma.result.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        eventId: true,
        roundId: true,
        createdAt: true,
        updatedAt: true,
        person: {
          select: {
            id: true,
            name: true,
            registrantId: true,
            wcaId: true,
            gender: true,
            countryIso2: true,
          },
        },
        Attempt: {
          select: {
            id: true,
            attemptNumber: true,
            replacedBy: true,
            isDelegate: true,
            isResolved: true,
            penalty: true,
            solvedAt: true,
            comment: true,
            createdAt: true,
            isExtraAttempt: true,
            extraGiven: true,
            value: true,
            judgeId: true,
            judge: {
              select: {
                id: true,
                name: true,
                registrantId: true,
                gender: true,
              },
            },
            station: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
    return {
      ...result,
      attempts: result.Attempt.map((attempt) => {
        return {
          ...attempt,
          solvedAt: attempt.solvedAt ? attempt.solvedAt : attempt.createdAt,
          judge: attempt.judge && {
            id: attempt.judge.id,
            name: attempt.judge.name,
            registrantId: attempt.judge.registrantId,
            gender: attempt.judge.gender,
          },
          station: attempt.station && {
            id: attempt.station.id,
            name: attempt.station.name,
          },
        };
      }),
      Attempt: undefined,
    };
  }

  async getAttemptsByResultId(resultId: string) {
    const attempts = await this.prisma.attempt.findMany({
      where: {
        result: {
          id: resultId,
        },
      },
      select: {
        id: true,
        resultId: true,
        attemptNumber: true,
        replacedBy: true,
        isDelegate: true,
        isResolved: true,
        penalty: true,
        comment: true,
        isExtraAttempt: true,
        extraGiven: true,
        value: true,
        solvedAt: true,
        createdAt: true,
        judge: {
          select: {
            id: true,
            registrantId: true,
            wcaId: true,
            name: true,
          },
        },
        station: {
          select: {
            id: true,
            name: true,
          },
        },
        result: {
          select: {
            id: true,
            eventId: true,
            roundId: true,
            createdAt: true,
            updatedAt: true,
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
    return attempts
      .map((attempt) => {
        return {
          ...attempt,
          judge: attempt.judge
            ? attempt.judge
            : {
                id: 0,
                registrantId: 0,
                wcaId: '',
                name: 'None',
              },
        };
      })
      .sort((a, b) => a.attemptNumber - b.attemptNumber);
  }

  async enterAttempt(data: EnterAttemptDto) {
    console.log('-----------------');
    console.log(new Date().toISOString());
    console.log('Entering attempt from FKM');
    console.log('Data: ', data);
    console.log('-----------------');
    const station = await this.prisma.station.findFirst({
      where: {
        espId: data.espId.toString(),
      },
      select: {
        id: true,
        espId: true,
        name: true,
        room: {
          select: {
            id: true,
            currentRoundId: true,
          },
        },
      },
    });
    if (!station) {
      throw new HttpException(
        {
          message: 'Station not found',
          shouldResetTime: false,
        },
        404,
      );
    }
    if (!station.room.currentRoundId) {
      throw new HttpException(
        {
          message: 'No round in this room',
          shouldResetTime: false,
        },
        400,
      );
    }
    const competitor = await this.prisma.person.findFirst({
      where: {
        cardId: data.competitorId.toString(),
      },
    });
    let locale = 'PL';
    if (!competitor) {
      throw new HttpException(
        {
          message:
            locale === 'PL'
              ? pl['competitorNotFound']
              : en['competitorNotFound'],
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
          stationId: station.id,
        },
      });
    if (previousAttemptWithSameSessionId) {
      throw new HttpException(
        {
          message:
            locale === 'PL'
              ? pl['attemptAlreadyEntered']
              : en['attemptAlreadyEntered'],
          shouldResetTime: false,
        },
        400,
      );
    }

    const judge = await this.prisma.person.findFirst({
      where: {
        cardId: data.judgeId.toString(),
      },
    });
    if (!judge && !data.isDelegate) {
      throw new HttpException(
        {
          message: locale === 'PL' ? pl['judgeNotFound'] : en['judgeNotFound'],
          shouldResetTime: false,
        },
        404,
      );
    }
    if (judge) {
      if (judge.countryIso2 === 'PL' && competitor.countryIso2 === 'PL') {
        locale = 'PL';
      } else {
        locale = 'EN';
      }
    }
    const competition = await this.prisma.competition.findFirst();
    if (!competition) {
      throw new HttpException(
        {
          message:
            locale === 'PL'
              ? pl['competitionNotFound']
              : en['competitionNotFound'],
          shouldResetTime: true,
        },
        404,
      );
    }
    const wcif = JSON.parse(JSON.stringify(competition.wcif));
    const currentRoundId = station.room.currentRoundId;
    const eventInfo = wcif.events.find(
      (event) => event.id === currentRoundId.split('-')[0],
    );
    const roundInfo = eventInfo.rounds.find(
      (round) => round.id === currentRoundId,
    );
    const competitorWcifInfo = wcif.persons.find(
      (person) => person.registrantId === competitor.registrantId,
    );
    const isCompetitorSignedInForEvent = this.isCompetitorSignedInForEvent(
      competitorWcifInfo,
      currentRoundId.split('-')[0],
    );
    if (!isCompetitorSignedInForEvent) {
      throw new HttpException(
        {
          message:
            locale === 'PL'
              ? pl['competitorIsNotSignedInForEvent']
              : en['competitorIsNotSignedInForEvent'],
          shouldResetTime: true,
        },
        400,
      );
    }
    const resultFromDb = await this.prisma.result.findFirst({
      where: {
        personId: competitor.id,
        roundId: currentRoundId,
      },
    });

    if (!resultFromDb) {
      await this.prisma.result.create({
        data: {
          person: {
            connect: {
              id: competitor.id,
            },
          },
          eventId: currentRoundId.split('-')[0],
          roundId: currentRoundId,
        },
      });
    }

    const result = await this.prisma.result.findFirst({
      where: {
        personId: competitor.id,
        roundId: currentRoundId,
      },
    });

    const attempts = await this.prisma.attempt.findMany({
      where: {
        resultId: result.id,
      },
    });

    const finalData = await this.getValidatedData(roundInfo, attempts, data);

    if (!finalData.cutoffPassed) {
      throw new HttpException(
        {
          message:
            locale === 'PL' ? pl['cutoffNotPassed'] : en['cutoffNotPassed'],
          shouldResetTime: true,
        },
        400,
      );
    }

    const sortedAttempts = attempts
      .filter((attempt) => attempt.isExtraAttempt === false)
      .sort((a, b) => a.attemptNumber - b.attemptNumber);
    const sortedExtraAttempts = attempts
      .filter((attempt) => attempt.isExtraAttempt === true)
      .sort((a, b) => a.attemptNumber - b.attemptNumber);
    const lastExtra =
      sortedExtraAttempts.length > 0 ? sortedExtraAttempts.length : 0;
    if (
      attempts.some(
        (attempt) =>
          attempt.extraGiven === true &&
          (attempt.replacedBy === 0 || attempt.replacedBy === null),
      )
    ) {
      const lastAttemptToReplace = attempts.find(
        (attempt) =>
          attempt.extraGiven === true &&
          (attempt.replacedBy === 0 || attempt.replacedBy === null),
      );

      const attemptNumber =
        await this.createAnExtraAttemptAnReplaceTheOriginalOne(
          {
            ...finalData,
            station,
            judge,
            competitor,
            result,
            attemptNumber: lastExtra + 1,
          },
          lastAttemptToReplace.id,
        );

      if (attemptNumber === -1) {
        await this.sendNotificationAboutIncident(station.name, competitor.name);
        return {
          message:
            locale === 'PL'
              ? pl['delegateWasNotified']
              : en['delegateWasNotified'],
        };
      }

      await this.enterAttemptToWcaLive(
        competition.wcaId,
        competition.scoretakingToken,
        currentRoundId.split('-')[0],
        parseInt(currentRoundId.split('-r')[1]),
        competitor.registrantId,
        attemptNumber,
        finalData.timeToEnter,
      );
      return {
        message: finalData.limitPassed
          ? locale === 'PL'
            ? pl['attemptEntered']
            : en['attemptEntered']
          : locale === 'PL'
            ? pl['attemptEnteredButReplacedToDnf']
            : en['attemptEnteredButReplacedToDnf'],
      };
    }
    let attemptNumber = 1;
    const lastAttempt = sortedAttempts[sortedAttempts.length - 1];
    const maxAttempts = roundInfo.format === 'a' ? 5 : 3;
    if (lastAttempt && lastAttempt.attemptNumber === maxAttempts) {
      throw new HttpException(
        {
          message:
            locale === 'PL' ? pl['noAttemptsLeft'] : en['noAttemptsLeft'],
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
        isDelegate: finalData.isDelegate,
        isExtraAttempt: false,
        isResolved: false,
        solvedAt: data.solvedAt,
        penalty: finalData.penalty,
        value: finalData.value,
        judge: judge
          ? {
              connect: {
                id: judge.id,
              },
            }
          : undefined,
        station: {
          connect: {
            id: station.id,
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
      await this.sendNotificationAboutIncident(station.name, competitor.name);
      return {
        message:
          locale === 'PL'
            ? pl['delegateWasNotified']
            : en['delegateWasNotified'],
      };
    }
    try {
      await this.enterAttemptToWcaLive(
        competition.wcaId,
        competition.scoretakingToken,
        currentRoundId.split('-')[0],
        parseInt(currentRoundId.split('-r')[1]),
        competitor.registrantId,
        attemptNumber,
        finalData.timeToEnter,
      );
    } catch (e) {
      return {
        message: locale === 'PL' ? pl['attemptEntered'] : en['attemptEntered'],
      };
    }
    if (finalData.dnsOther) {
      for (let i = 0; i < maxAttempts - attemptNumber; i++) {
        await this.prisma.attempt.create({
          data: {
            attemptNumber: attemptNumber + i + 1,
            isDelegate: false,
            isExtraAttempt: false,
            isResolved: false,
            penalty: -2,
            value: 0,
            result: {
              connect: {
                id: result.id,
              },
            },
          },
        });
        await this.enterAttemptToWcaLive(
          competition.wcaId,
          competition.scoretakingToken,
          currentRoundId.split('-')[0],
          parseInt(currentRoundId.split('-r')[1]),
          competitor.registrantId,
          attemptNumber + i + 1,
          -2,
        );
      }
    }
    return {
      message: finalData.limitPassed
        ? locale === 'PL'
          ? pl['attemptEntered']
          : en['attemptEntered']
        : locale === 'PL'
          ? pl['attemptEnteredButReplacedToDnf']
          : en['attemptEnteredButReplacedToDnf'],
    };
  }

  async enterAttemptToWcaLive(
    competitionId: string,
    scoretakingToken: string,
    eventId: string,
    roundNumber: number,
    registrantId: number,
    attemptNumber: number,
    attemptResult: number,
  ) {
    const competition = await this.prisma.competition.findFirst();
    const url = competition.usesWcaProduction
      ? WCA_LIVE_API_ORIGIN
      : WCA_LIVE_DEV_API_ORIGIN;
    console.log('-----------------');
    console.log(new Date().toISOString());
    console.log('Sending attempt to WCA Live');
    console.log(`Round: ${eventId}-r${roundNumber}`);
    console.log('attemptNumber: ', attemptNumber);
    console.log('registrantId: ', registrantId);
    console.log('attemptResult: ', attemptResult);
    const response = await fetch(`${url}/enter-attempt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${scoretakingToken}`,
      },
      body: JSON.stringify({
        competitionWcaId: competitionId,
        eventId: eventId,
        roundNumber: roundNumber,
        registrantId: registrantId,
        attemptNumber: attemptNumber,
        attemptResult: attemptResult,
      }),
    });
    console.log('WCA Live response: ', response.status);
    const data = await response.json();
    console.log('WCA Live response data: ', data);
    console.log('-----------------');
    return response.status;
  }

  async enterWholeScorecardToWcaLive(resultId: string) {
    const result = await this.getResultById(resultId);
    const competition = await this.prisma.competition.findFirst();
    const { competitionId, eventId, roundNumber, scoretakingToken, results } =
      await this.getAttemptsToEnterToWcaLive(result, competition);
    const url = competition.usesWcaProduction
      ? WCA_LIVE_API_ORIGIN
      : WCA_LIVE_DEV_API_ORIGIN;
    console.log('-----------------');
    console.log(new Date().toISOString());
    console.log('Sending scorecard to WCA Live');
    console.log(`Round: ${eventId}-r${roundNumber}`);
    console.log('results: ', results);
    const response = await fetch(`${url}/enter-results`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${scoretakingToken}`,
      },
      body: JSON.stringify({
        competitionWcaId: competitionId,
        eventId: eventId,
        roundNumber: roundNumber,
        results: results,
      }),
    });
    console.log('WCA Live response: ', response.status);
    const data = await response.json();
    console.log('WCA Live response data: ', data);
    console.log('-----------------');
    if (response.status !== 200) {
      throw new HttpException('WCA Live error', 500);
    } else {
      return {
        message: 'Scorecard submitted',
      };
    }
  }

  async enterRoundToWcaLive(roundId: string) {
    const results = await this.getAllResultsByRound(roundId);
    const competition = await this.prisma.competition.findFirst();
    const eventIdToSubmit = results[0].eventId;
    const roundNumberToSubmit = +results[0].roundId.split('-r')[1];

    const resultsToSubmit = [];
    for (const result of results) {
      const { results } = await this.getAttemptsToEnterToWcaLive(
        result,
        competition,
      );
      resultsToSubmit.push(...results);
    }
    const url = competition.usesWcaProduction
      ? WCA_LIVE_API_ORIGIN
      : WCA_LIVE_DEV_API_ORIGIN;
    console.log('-----------------');
    console.log(new Date().toISOString());
    console.log('Sending round to WCA Live');
    console.log(`Round: ${eventIdToSubmit}-r${roundNumberToSubmit}`);
    const response = await fetch(`${url}/enter-results`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${competition.scoretakingToken}`,
      },
      body: JSON.stringify({
        competitionWcaId: competition.wcaId,
        eventId: eventIdToSubmit,
        roundNumber: roundNumberToSubmit,
        results: resultsToSubmit,
      }),
    });
    console.log('WCA Live response: ', response.status);
    const data = await response.json();
    console.log('WCA Live response data: ', data);
    console.log('-----------------');
    if (response.status !== 200) {
      throw new HttpException('WCA Live error', 500);
    } else {
      return {
        message: 'Round resubmitted',
      };
    }
  }

  async getAttemptsToEnterToWcaLive(result: any, competition: any) {
    const attemptsToReturn = [];
    const sortedAttempts = result.attempts.sort(
      (a, b) => a.attemptNumber - b.attemptNumber,
    );
    sortedAttempts.forEach((attempt) => {
      if (
        attempt.replacedBy === null &&
        !attempt.extraGiven &&
        !attemptsToReturn.some((a) => a.id === attempt.id) &&
        !attempt.isExtraAttempt
      )
        attemptsToReturn.push(attempt);
      if (attempt.replacedBy !== null && attempt.extraGiven) {
        const extraAttempt = result.attempts.find(
          (a) =>
            a.attemptNumber === attempt.replacedBy && a.isExtraAttempt === true,
        );
        if (
          extraAttempt &&
          !attemptsToReturn.some((a) => a.id === extraAttempt.id)
        ) {
          attemptsToReturn.push(extraAttempt);
        }
      }
    });

    const timesToSubmit = attemptsToReturn.map((attempt) => {
      return {
        result:
          attempt.penalty === -2
            ? -2
            : attempt.penalty === -1
              ? -1
              : attempt.penalty * 100 + attempt.value,
      };
    });
    return {
      competitionId: competition.wcaId,
      scoretakingToken: competition.scoretakingToken,
      eventId: result.eventId,
      roundNumber: parseInt(result.roundId.split('-r')[1]),
      results: [
        {
          registrantId: result.person.registrantId,
          attempts: timesToSubmit,
        },
      ],
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
        isDelegate: data.isDelegate,
        isExtraAttempt: true,
        solvedAt: data.solvedAt,
        isResolved: false,
        penalty: data.penalty,
        value: data.value,
        judge: data.judge
          ? {
              connect: {
                id: data.judge.id,
              },
            }
          : undefined,
        station: {
          connect: {
            id: data.station.id,
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

  async sendNotificationAboutIncident(
    stationName: string,
    competitorName: string,
  ) {
    const expo = new Expo();
    const messages = [];
    const accounts = await this.prisma.account.findMany({
      where: {
        notificationToken: {
          not: null,
        },
      },
    });
    for (const account of accounts) {
      if (!Expo.isExpoPushToken(account.notificationToken)) {
        continue;
      }
      messages.push({
        to: account.notificationToken,
        sound: 'default',
        title: `New incident at station ${stationName}`,
        body: `Competitor ${competitorName} has a problem`,
      });
    }
    await expo.sendPushNotificationsAsync(messages);
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
        !attempt.extraGiven &&
        !submittedAttempts.some((a) => a.id === attempt.id) &&
        !attempt.isExtraAttempt
      )
        submittedAttempts.push(attempt);
      if (attempt.replacedBy !== null && attempt.extraGiven) {
        const extraAttempt = attempts.find(
          (a) =>
            a.attemptNumber === attempt.replacedBy && a.isExtraAttempt === true,
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
        !this.checkAttemptLimit(
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
        !this.checkCutoff(
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

  private isCompetitorSignedInForEvent(
    competitorWcif: any,
    currentEventId: string,
  ) {
    return competitorWcif.registration.eventIds.includes(currentEventId);
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

  private checkAttemptLimit(time: number, limit: number) {
    return time < limit;
  }

  private checkCutoff(attempts: any[], cutoff: number, attemptsNumber: number) {
    if (attempts.length < attemptsNumber) return true;
    else {
      return attempts.some(
        (attempt) =>
          attempt.penalty !== -1 &&
          attempt.value + attempt.penalty * 100 < cutoff,
      );
    }
  }
}
