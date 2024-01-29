import { ResultService } from './../result/result.service';
import { DbService } from '../db/db.service';
import { HttpException, Injectable } from '@nestjs/common';
import { UpdateAttemptDto } from './dto/updateAttempt.dto';

@Injectable()
export class AttemptService {
  constructor(
    private readonly prisma: DbService,
    private readonly resultService: ResultService,
  ) {}

  async updateAttempt(id: number, data: UpdateAttemptDto) {
    if (!data.extraGiven || data.replacedBy === 0) {
      data.replacedBy = null;
    }
    const attempt = await this.prisma.attempt.update({
      where: { id: id },
      data: data,
      select: {
        id: true,
        result: {
          select: {
            person: {
              select: {
                registrantId: true,
              },
            },
          },
        },
      },
    });
    if (!attempt) {
      throw new HttpException('Attempt not found', 404);
    }
    if (data.submitToWcaLive && !data.extraGiven && !data.replacedBy) {
      const competition = await this.prisma.competition.findFirst();
      const sliced = competition.currentGroupId.split('-');
      const currentRoundId = sliced[0] + '-' + sliced[1];
      const timeToEnterAttemptToWcaLive =
        data.penalty === -1 ? -1 : data.penalty * 100 + data.value;
      const status = await this.resultService.enterAttemptToWcaLive(
        competition.wcaId,
        competition.scoretakingToken,
        currentRoundId.split('-')[0],
        parseInt(currentRoundId.split('-r')[1]),
        attempt.result.person.registrantId,
        data.attemptNumber,
        timeToEnterAttemptToWcaLive,
      );
      if (status === 200) {
        return attempt;
      }
    }
  }

  async deleteAttempt(id: number) {
    return await this.prisma.attempt.delete({
      where: { id: id },
    });
  }

  async getAttemptById(id: number) {
    return await this.prisma.attempt.findUnique({
      where: { id },
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
        result: {
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
          },
        },
      },
    });
  }

  async getUnresolvedAttempts() {
    return await this.prisma.attempt.findMany({
      where: { isDelegate: true, isResolved: false },
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
        result: {
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
          },
        },
      },
    });
  }
}
