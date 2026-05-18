import { HttpException, Injectable } from '@nestjs/common';
import {
  AttemptStatus,
  AttemptType,
  StaffActivityStatus,
  StaffRole,
} from '@prisma/client';
import { Event, Round, TimeLimit } from '@wca/helpers';
import { AppGateway } from 'src/app.gateway';
import { DNS_VALUE, publicPersonSelect, publicUserSelect } from 'src/constants';
import { ContestsService } from 'src/contests/contests.service';
import { DbService } from 'src/db/db.service';
import { isUnofficialEvent } from 'src/events';
import { getMaxAttempts, isCumulativeLimit } from 'src/wcif-helpers';
import { getRoundInfoFromWcif } from 'wcif-helpers';

import { AttendanceService } from '../attendance/attendance.service';
import { WcaService } from '../wca/wca.service';
import { CheckIfAttemptEnteredDto } from './dto/checkIfAttemptEntered.dto';
import { DoubleCheckDto } from './dto/doubleCheck.dto';
import { getSortedStandardAttempts } from './helpers';

@Injectable()
export class ResultService {
  constructor(
    private readonly prisma: DbService,
    private readonly appGateway: AppGateway,
    private readonly attendanceService: AttendanceService,
    private readonly wcaService: WcaService,
    private readonly contestsService: ContestsService,
  ) {}

  resultsInclude = {
    person: publicPersonSelect,
    attempts: {
      include: {
        judge: publicPersonSelect,
        scrambler: publicPersonSelect,
        device: true,
      },
    },
  };

  attemptsInclude = {
    judge: publicPersonSelect,
    scrambler: publicPersonSelect,
    result: {
      include: {
        person: publicPersonSelect,
      },
    },
  };

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
      include: this.resultsInclude,
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
                status: StaffActivityStatus.ABSENT,
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
        person: publicPersonSelect,
        attempts: {
          include: {
            judge: publicPersonSelect,
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
        person: publicPersonSelect,
        doubleCheckedBy: publicUserSelect,
        attempts: {
          include: {
            judge: publicPersonSelect,
            scrambler: publicPersonSelect,
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

    const remainingAndUsedCumulativeLimit =
      await this.getRemainingAndUsedCumulativeLimit(id);

    return {
      ...result,
      remainingAndUsedCumulativeLimit,
    };
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
        person: publicPersonSelect,
        attempts: {
          include: {
            judge: publicPersonSelect,
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
        throw new HttpException('Cubing Contests token not found', 404);
      }
      return await this.contestsService.enterRoundToCubingContests(results);
    } else {
      return await this.wcaService.enterRoundToWcaLive(roundId, results);
    }
  }

  async restartGroup(groupId: string) {
    const staffActivity =
      await this.attendanceService.getAttendanceByGroupId(groupId);
    const competitors = staffActivity.filter(
      (activity) =>
        activity.status === StaffActivityStatus.PRESENT &&
        activity.role === StaffRole.COMPETITOR,
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
        status: StaffActivityStatus.ABSENT,
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
    const maxAttempts = getMaxAttempts(roundInfo.format);
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
          penalty: DNS_VALUE,
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

  async getResultsToDoubleCheckByRoundId(roundId: string) {
    const results = await this.prisma.result.findMany({
      where: {
        roundId: roundId,
        isDoubleChecked: false,
      },
      include: this.resultsInclude,
    });
    const totalCount = await this.prisma.result.count({
      where: {
        roundId: roundId,
      },
    });
    const doubleCheckedCount = await this.prisma.result.count({
      where: {
        roundId: roundId,
        isDoubleChecked: true,
      },
    });

    return {
      results: results,
      totalCount: totalCount,
      doubleCheckedCount: doubleCheckedCount,
    };
  }

  async doubleCheckResult(data: DoubleCheckDto, userId: string) {
    const result = await this.prisma.result.update({
      where: {
        id: data.resultId,
      },
      data: {
        isDoubleChecked: true,
        doubleCheckedAt: new Date(),
        doubleCheckedBy: {
          connect: {
            id: userId,
          },
        },
      },
    });
    for (const attempt of data.attempts) {
      await this.prisma.attempt.update({
        where: {
          id: attempt.id,
        },
        data: {
          penalty: attempt.penalty,
          value: attempt.value,
        },
      });
    }
    this.appGateway.handleResultEntered(result.roundId);
    await this.enterWholeScorecardToWcaLiveOrCubingContests(result.id);
  }

  async undoDoubleCheckResultsByRoundId(roundId: string) {
    return this.prisma.result.updateMany({
      where: {
        roundId: roundId,
      },
      data: {
        isDoubleChecked: false,
      },
    });
  }

  async getResultsChecks(roundId?: string) {
    const whereParams = {};
    if (roundId) {
      whereParams['result'] = {
        roundId: roundId,
      };
    }
    const competition = await this.prisma.competition.findFirst();
    const wcif = JSON.parse(JSON.stringify(competition.wcif));
    const exceededInspection = await this.prisma.attempt.findMany({
      where: {
        inspectionTime: {
          gt: 15000,
        },
        status: AttemptStatus.STANDARD,
        ...whereParams,
      },
      include: this.attemptsInclude,
    });
    const dns = await this.prisma.attempt.findMany({
      where: {
        penalty: DNS_VALUE,
        status: AttemptStatus.STANDARD,
        ...whereParams,
      },
      include: this.attemptsInclude,
    });

    const penalties = await this.prisma.attempt.findMany({
      where: {
        penalty: {
          gt: 2,
        },
        ...whereParams,
      },
      include: this.attemptsInclude,
    });
    const attempts = [];
    for (const attempt of exceededInspection) {
      const alreadyChecked = attempts.some((a) => a.id === attempt.id);
      if (!alreadyChecked) {
        attempts.push(attempt);
      }
    }
    for (const attempt of penalties) {
      const alreadyChecked = attempts.some((a) => a.id === attempt.id);
      if (!alreadyChecked) {
        attempts.push(attempt);
      }
    }
    for (const attempt of dns) {
      const alreadyChecked = attempts.some((a) => a.id === attempt.id);
      const cumulative = isCumulativeLimit(attempt.result.roundId, wcif);
      if (!alreadyChecked && !cumulative) {
        attempts.push(attempt);
      }
    }
    return attempts;
  }

  async getSubmittedAttempts(roundId: string, personId: string) {
    const attempts = await this.prisma.attempt.findMany({
      where: {
        result: {
          personId,
          roundId,
        },
        status: {
          not: AttemptStatus.SCRAMBLED,
        },
      },
    });
    const submittedAttempts = [];
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
    return submittedAttempts;
  }

  async checkCumulativeLimit(
    personId: string,
    limit: TimeLimit,
    submittedAttempts: any[],
  ) {
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
        personId,
        limit.cumulativeRoundIds,
        limit.centiseconds,
      );
    }
  }

  async getCumulativeSumForMultipleRounds(
    personId: string,
    roundsIds: string[],
  ) {
    let used = 0;
    for (const roundId of roundsIds) {
      const submittedAttempts = await this.getSubmittedAttempts(
        roundId,
        personId,
      );
      submittedAttempts.forEach((attempt) => {
        if (attempt.penalty !== -1) {
          used += attempt.value + attempt.penalty * 100;
        } else {
          used += attempt.value;
        }
      });
    }
    return used;
  }

  async checkCumulativeLimitForMultipleRounds(
    personId: string,
    roundsIds: string[],
    limit: number,
  ) {
    const used = await this.getCumulativeSumForMultipleRounds(
      personId,
      roundsIds,
    );
    return used < limit;
  }

  async getRemainingAndUsedCumulativeLimit(resultId: string) {
    const result = await this.prisma.result.findUnique({
      where: {
        id: resultId,
      },
    });
    if (!result) {
      throw new Error('Result not found');
    }
    const competition = await this.prisma.competition.findFirst();
    if (!competition) {
      throw new Error('Competition not found');
    }
    const wcif = JSON.parse(JSON.stringify(competition.wcif));
    const roundInfo = getRoundInfoFromWcif(result.roundId, wcif);
    if (!roundInfo.timeLimit.cumulativeRoundIds.length) {
      return {
        remaining: null,
        used: null,
      };
    }
    const { personId, roundId } = result;
    const roundsIds =
      roundInfo.timeLimit.cumulativeRoundIds.length > 1
        ? roundInfo.timeLimit.cumulativeRoundIds
        : [roundId];
    const used = await this.getCumulativeSumForMultipleRounds(
      personId,
      roundsIds,
    );
    const limit = roundInfo.timeLimit.centiseconds;
    return {
      used,
      remaining: Math.max(0, limit - used),
    };
  }
}
