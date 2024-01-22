import { HttpException, Injectable } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import { EnterAttemptDto } from './dto/enterAttempt.dto';

const WCA_LIVE_API_ORIGIN = process.env.WCA_LIVE_API_ORIGIN;
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
        groupId: true,
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

  async getAllResultsByPerson(personId: number) {
    const results = await this.prisma.result.findMany({
      where: {
        personId: personId,
      },
      select: {
        id: true,
        eventId: true,
        roundId: true,
        groupId: true,
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

  async getResultById(id: number) {
    const result = await this.prisma.result.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        eventId: true,
        roundId: true,
        groupId: true,
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
            createdAt: true,
            isExtraAttempt: true,
            extraGiven: true,
            value: true,
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

  async enterAttempt(data: EnterAttemptDto) {
    const station = await this.prisma.station.findFirst({
      where: {
        espId: data.espId.toString(),
      },
    });
    if (!station) {
      throw new HttpException('Station not found', 404);
    }
    const competitor = await this.prisma.person.findFirst({
      where: {
        cardId: data.competitorId.toString(),
      },
    });
    if (!competitor) {
      throw new HttpException('Competitor not found', 404);
    }
    const judge = await this.prisma.person.findFirst({
      where: {
        cardId: data.judgeId.toString(),
      },
    });
    if (!judge && !data.isDelegate) {
      throw new HttpException('Judge not found', 404);
    }
    const competition = await this.prisma.competition.findFirst();
    if (!competition) {
      throw new HttpException('Competition not found', 404);
    }
    const wcif = JSON.parse(JSON.stringify(competition.wcif));
    const sliced = competition.currentGroupId.split('-');
    const currentRoundId = sliced[0] + '-' + sliced[1];
    const currentGroup = this.getGroupFromWcif(
      wcif,
      currentRoundId,
      competition.currentGroupId,
    );
    const eventInfo = wcif.events.find((event) => event.id === sliced[0]);
    const roundInfo = eventInfo.rounds.find(
      (round) => round.id === currentRoundId,
    );
    const competitorWcifInfo = wcif.persons.find(
      (person) => person.registrantId === competitor.registrantId,
    );
    const isCompetitorInThisGroup = this.isCompetitorInThisGroup(
      competitorWcifInfo,
      currentGroup.id,
    );
    if (!isCompetitorInThisGroup) {
      throw new HttpException('Competitor is not in this group', 400);
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
          groupId: competition.currentGroupId,
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

    const finalData = this.getValidatedData(roundInfo, attempts, data);

    if (!finalData.cutoffPassed) {
      throw new HttpException('Cutoff not passed', 400);
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
        //TODO: Send notification to delegate
        return {
          message: 'Delegate was notified',
        };
      }

      const status = await this.enterAttemptToWcaLive(
        competition.wcaId,
        competition.scoretakingToken,
        currentRoundId.split('-')[0],
        parseInt(currentRoundId.split('-r')[1]),
        competitor.registrantId,
        attemptNumber,
        finalData.timeToEnter,
      );
      if (status !== 200) {
        throw new HttpException('WCA Live error', 500);
      }
      return {
        message: finalData.limitPassed
          ? 'Attempt entered'
          : 'Attempt entered, but replaced to DNF',
      };
    }
    let attemptNumber = 1;
    const lastAttempt = sortedAttempts[sortedAttempts.length - 1];
    const maxAttempts = roundInfo.format === 'a' ? 5 : 3;
    if (lastAttempt && lastAttempt.attemptNumber === maxAttempts) {
      throw new HttpException('No attempts left', 400);
    }
    if (lastAttempt) {
      attemptNumber = lastAttempt.attemptNumber + 1;
    }
    await this.prisma.attempt.create({
      data: {
        attemptNumber: attemptNumber,
        isDelegate: finalData.isDelegate,
        isExtraAttempt: false,
        isResolved: false,
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
      return {
        message: 'Delegate was notified',
      };
    }
    const status = await this.enterAttemptToWcaLive(
      competition.wcaId,
      competition.scoretakingToken,
      currentRoundId.split('-')[0],
      parseInt(currentRoundId.split('-r')[1]),
      competitor.registrantId,
      attemptNumber,
      finalData.timeToEnter,
    );
    if (status !== 200) {
      throw new HttpException('WCA Live error', 500);
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
        ? 'Attempt entered'
        : 'Attempt entered, but replaced to DNF',
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
    const response = await fetch(`${WCA_LIVE_API_ORIGIN}/api/enter-attempt`, {
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
    return response.status;
  }

  async enterWholeScorecardToWcaLive(resultId: number) {
    const result = await this.getResultById(resultId);
    const competition = await this.prisma.competition.findFirst();
    const sliced = competition.currentGroupId.split('-');
    const currentRoundId = sliced[0] + '-' + sliced[1];
    const attemptsToReturn = [];
    result.attempts.forEach((attempt) => {
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
          attempt.penalty === -1 ? -1 : attempt.penalty * 100 + attempt.value,
      };
    });
    const response = await fetch(`${WCA_LIVE_API_ORIGIN}/api/enter-results`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${competition.scoretakingToken}`,
      },
      body: JSON.stringify({
        competitionWcaId: competition.wcaId,
        eventId: currentRoundId.split('-')[0],
        roundNumber: parseInt(currentRoundId.split('-r')[1]),
        results: [
          {
            registrantId: result.person.registrantId,
            attempts: timesToSubmit,
          },
        ],
      }),
    });
    if (response.status !== 200) {
      throw new HttpException('WCA Live error', 500);
    } else {
      return {
        message: 'Scorecard submitted',
      };
    }
  }

  async createAnExtraAttemptAnReplaceTheOriginalOne(
    data: any,
    originalId: number,
  ) {
    const extraAttempt = await this.prisma.attempt.create({
      data: {
        attemptNumber: data.attemptNumber,
        isDelegate: data.isDelegate,
        isExtraAttempt: true,
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

  private getValidatedData(
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

    if (submittedAttempts.length > 0) {
      if (wcifRoundInfo.timeLimit.cumulativeRoundIds.length > 0) {
        if (
          !this.checkCumulativeLimit(wcifRoundInfo.timeLimit.centiseconds, [
            ...submittedAttempts,
            newAttemptData,
          ])
        ) {
          limitPassed = false;
          dataToReturn.penalty = -1;
          dataToReturn.dnsOther = true;
          timeToEnterToWcaLive = -1;
        }
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

  private checkCumulativeLimit(limit: number, submittedAttempts: any[]) {
    let sum = 0;
    submittedAttempts.forEach((attempt) => {
      if (attempt.penalty !== -1) {
        sum += attempt.value + attempt.penalty * 100;
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
      if (
        attempts.some(
          (attempt) =>
            attempt.penalty !== -1 &&
            attempt.value + attempt.penalty * 100 < cutoff,
        )
      ) {
        return true;
      }
      return false;
    }
  }

  private isCompetitorInThisGroup(competitorWcif: any, currentGroupId: number) {
    return competitorWcif.assignments.some(
      (assignment) =>
        assignment.activityId === currentGroupId &&
        assignment.assignmentCode === 'competitor',
    );
  }

  private getGroupFromWcif(
    wcif: any,
    currentRoundId: string,
    currentGroupId: string,
  ) {
    return wcif.schedule.venues[0].rooms[0].activities
      .find((activity) => activity.activityCode === currentRoundId)
      .childActivities.find(
        (activity) => activity.activityCode === currentGroupId,
      );
  }
}
