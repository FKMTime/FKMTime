import { HttpException, Injectable } from '@nestjs/common';
import { AttemptStatus, AttemptType, StaffRole } from '@prisma/client';
import { Event, Round } from '@wca/helpers';
import { DbService } from 'src/db/db.service';
import { AttendanceService } from '../attendance/attendance.service';
import { WcaService } from '../wca/wca.service';
import { CheckIfAttemptEnteredDto } from './dto/checkIfAttemptEntered.dto';
import { getSortedStandardAttempts } from './helpers';
import { isUnofficialEvent } from 'src/events';
import { ContestsService } from 'src/contests/contests.service';
import { AppGateway } from 'src/app.gateway';

@Injectable()
export class ResultService {
  constructor(
    private readonly prisma: DbService,
    private readonly appGateway: AppGateway,
    private readonly attendanceService: AttendanceService,
    private readonly wcaService: WcaService,
    private readonly contestsService: ContestsService,
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
    const result = await this.prisma.result.findUnique({
      where: {
        id: id,
      },
    });
    if (!result) {
      throw new HttpException('Result not found', 404);
    }
    const personActivities = await this.prisma.staffActivity.findMany({
      where: {
        personId: result.personId,
      },
    });
    if (personActivities) {
      for (const activity of personActivities) {
        if (
          activity.role === StaffRole.COMPETITOR &&
          activity.groupId.includes(result.roundId)
        ) {
          if (activity.isAssigned) {
            await this.prisma.staffActivity.update({
              where: {
                id: activity.id,
              },
              data: {
                isPresent: false,
              },
            });
          } else {
            await this.prisma.staffActivity.delete({
              where: {
                id: activity.id,
              },
            });
          }
        }
      }
    }
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
            updatedBy: {
              select: {
                id: true,
                fullName: true,
              },
            },
            device: true,
          },
        },
      },
    });
    return result;
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

  async checkIfAttemptEntered(data: CheckIfAttemptEnteredDto) {
    const attempt = await this.prisma.attempt.findFirst({
      where: {
        sessionId: data.sessionId,
        device: {
          espId: data.espId,
        },
      },
    });
    return !!attempt;
  }

  async enterWholeScorecardToWcaLiveOrCubingContests(resultId: string) {
    const result = await this.getResultById(resultId);
    const isUnofficial = isUnofficialEvent(result.eventId);
    const competition = await this.prisma.competition.findFirst();
    if (isUnofficial) {
      if (!competition.cubingContestsToken) {
        return {
          message: 'Cubing Contests token not found',
          status: 404,
          error: true,
        };
      }
      return await this.contestsService.enterWholeScorecardToCubingContests(
        result,
      );
    }
    return await this.wcaService.enterWholeScorecardToWcaLive(result);
  }

  async enterRoundToWcaLiveOrCubingContests(roundId: string) {
    const isUnofficial = isUnofficialEvent(roundId.split('-')[0]);
    const competition = await this.prisma.competition.findFirst();
    const results = await this.getAllResultsByRound(roundId);
    if (isUnofficial) {
      if (!competition.cubingContestsToken) {
        return {
          message: 'Cubing Contests token not found',
          status: 404,
          error: true,
        };
      }
      return await this.contestsService.enterRoundToCubingContests(results);
    } else {
      return await this.wcaService.enterRoundToWcaLive(results);
    }
  }

  async restartGroup(groupId: string) {
    const staffActivity =
      await this.attendanceService.getAttendanceByGroupId(groupId);
    const competitors = staffActivity.filter(
      (activity) =>
        activity.isPresent && activity.role === StaffRole.COMPETITOR,
    );
    const roundId = groupId.split('-g')[0];
    const results = await this.prisma.result.findMany({
      where: {
        personId: {
          in: competitors.map((competitor) => competitor.personId),
        },
        roundId: roundId,
      },
    });
    await this.prisma.staffActivity.updateMany({
      where: {
        groupId: groupId,
      },
      data: {
        isPresent: false,
      },
    });
    await this.prisma.result.deleteMany({
      where: {
        id: {
          in: results.map((result) => result.id),
        },
      },
    });
    await this.enterRoundToWcaLiveOrCubingContests(roundId);
  }

  async assignDnsOnRemainingAttempts(resultId: string) {
    const result = await this.getResultById(resultId);
    const attempts = await this.prisma.attempt.findMany({
      where: {
        resultId: result.id,
      },
    });
    const wcif = await this.prisma.competition.findFirst().then((c) => {
      return JSON.parse(JSON.stringify(c.wcif));
    });
    const eventInfo = wcif.events.find(
      (event: Event) => event.id === result.eventId,
    );
    const roundInfo = eventInfo.rounds.find(
      (round: Round) => round.id === result.roundId,
    );
    const maxAttempts = roundInfo.format === 'a' ? 5 : 3;
    const sortedAttempts = getSortedStandardAttempts(attempts);
    const lastAttempt = sortedAttempts[sortedAttempts.length - 1];
    if (lastAttempt.attemptNumber === maxAttempts) {
      return {
        message: 'No attempts left',
        status: 400,
        error: true,
      };
    }
    for (let i = lastAttempt.attemptNumber + 1; i <= maxAttempts; i++) {
      await this.prisma.attempt.create({
        data: {
          attemptNumber: i,
          status: AttemptStatus.STANDARD,
          type: AttemptType.STANDARD_ATTEMPT,
          penalty: -2,
          solvedAt: new Date(),
          value: 0,
          result: {
            connect: {
              id: result.id,
            },
          },
        },
      });
    }
    this.appGateway.handleResultEntered(result.roundId);
    return {
      message: 'DNS added',
      status: 200,
      error: false,
    };
  }
}
