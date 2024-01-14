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
            judge: {
              id: attempt.judge.id,
              name: attempt.judge.name,
              registrantId: attempt.judge.registrantId,
              gender: attempt.judge.gender,
            },
            station: {
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
            judge: {
              id: attempt.judge.id,
              name: attempt.judge.name,
            },
            station: {
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
          judge: {
            id: attempt.judge.id,
            name: attempt.judge.name,
            registrantId: attempt.judge.registrantId,
            gender: attempt.judge.gender,
          },
          station: {
            id: attempt.station.id,
            name: attempt.station.name,
          },
        };
      }),
      Attempt: undefined,
    };
  }

  async enterAttempt(data: EnterAttemptDto) {
    //TODO: Simplify this code
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
    if (!judge) {
      throw new HttpException('Judge not found', 404);
    }
    const competition = await this.prisma.competition.findFirst();
    if (!competition) {
      throw new HttpException('Competition not found', 404);
    }
    const wcif = JSON.parse(JSON.stringify(competition.wcif));
    const sliced = competition.currentGroupId.split('-');
    const currentRoundId = sliced[0] + '-' + sliced[1];
    const currentGroup = wcif.schedule.venues[0].rooms[0].activities
      .find((activity) => activity.activityCode === currentRoundId)
      .childActivities.find(
        (activity) => activity.activityCode === competition.currentGroupId,
      );
    const competitorWcifInfo = wcif.persons.find(
      (person) => person.registrantId === competitor.registrantId,
    );
    const isCompetitorInThisGroup = competitorWcifInfo.assignments.some(
      (assignment) =>
        assignment.activityId === currentGroup.id &&
        assignment.assignmentCode === 'competitor',
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

    const timeToEnterAttemptToWcaLive =
      data.penalty === -1 ? -1 : data.penalty * 1000 + data.value;

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

    if (attempts.length === 0) {
      await this.prisma.attempt.create({
        data: {
          attemptNumber: 1,
          isDelegate: data.isDelegate,
          isExtraAttempt: false,
          isResolved: false,
          penalty: data.penalty,
          value: data.value,
          judge: {
            connect: {
              id: judge.id,
            },
          },
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
        //TODO: Send notification to delegate
      } else {
        const status = await this.enterAttemptToWcaLive(
          competition.wcaId,
          competition.scoretakingToken,
          currentRoundId.split('-')[0],
          parseInt(currentRoundId.split('-r')[1]),
          competitor.registrantId,
          1,
          timeToEnterAttemptToWcaLive,
        );
        if (status !== 200) {
          throw new HttpException('WCA Live error', 500);
        }
        return {
          message: 'Attempt entered',
        };
      }
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

      const extraAttempt = await this.prisma.attempt.create({
        data: {
          attemptNumber: lastExtra + 1,
          isDelegate: data.isDelegate,
          isExtraAttempt: true,
          isResolved: false,
          penalty: data.penalty,
          value: data.value,
          judge: {
            connect: {
              id: judge.id,
            },
          },
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
        //TODO: Send notification to delegate
        return {
          message: 'Delegate was notified',
        };
      }
      const attempt = await this.prisma.attempt.update({
        where: {
          id: lastAttemptToReplace.id,
        },
        data: {
          replacedBy: extraAttempt.attemptNumber,
        },
      });
      const status = await this.enterAttemptToWcaLive(
        competition.wcaId,
        competition.scoretakingToken,
        currentRoundId.split('-')[0],
        parseInt(currentRoundId.split('-r')[1]),
        competitor.registrantId,
        attempt.attemptNumber,
        timeToEnterAttemptToWcaLive,
      );
      if (status !== 200) {
        throw new HttpException('WCA Live error', 500);
      }
      return {
        message: 'Attempt entered',
      };
    }

    const lastAttempt = sortedAttempts[sortedAttempts.length - 1];
    const wcifEventInfo = wcif.events.find(
      (event) => event.id === currentRoundId.split('-')[0],
    );
    const maxAttempts = wcifEventInfo.format === 'a' ? 5 : 3;
    if (lastAttempt && lastAttempt.attemptNumber === maxAttempts) {
      throw new HttpException('No attempts left', 400);
    }

    await this.prisma.attempt.create({
      data: {
        attemptNumber: lastAttempt.attemptNumber + 1,
        isDelegate: data.isDelegate,
        isExtraAttempt: false,
        isResolved: false,
        penalty: data.penalty,
        value: data.value,
        judge: {
          connect: {
            id: judge.id,
          },
        },
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
      lastAttempt.attemptNumber + 1,
      timeToEnterAttemptToWcaLive,
    );
    if (status !== 200) {
      throw new HttpException('WCA Live error', 500);
    }
    return {
      message: 'Attempt entered',
    };
  }

  private async enterAttemptToWcaLive(
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
}
