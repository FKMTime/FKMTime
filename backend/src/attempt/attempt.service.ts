import { DbService } from '../db/db.service';
import { HttpException, Injectable } from '@nestjs/common';
import { UpdateAttemptDto } from './dto/updateAttempt.dto';
import { CreateAttemptDto } from './dto/createAttempt.dto';
import { IncidentsGateway } from './incidents.gateway';
import { AttemptStatus } from '@prisma/client';
import { WcaService } from '../wca/wca.service';

@Injectable()
export class AttemptService {
  constructor(
    private readonly prisma: DbService,
    private readonly wcaService: WcaService,
    private readonly incidentsGateway: IncidentsGateway,
  ) {}

  async createAttempt(data: CreateAttemptDto) {
    const resultFromDb = await this.prisma.result.findFirst({
      where: {
        personId: data.competitorId,
        roundId: data.roundId,
      },
      select: {
        id: true,
        roundId: true,
      },
    });
    if (!resultFromDb) {
      await this.prisma.result.create({
        data: {
          person: {
            connect: {
              id: data.competitorId,
            },
          },
          eventId: data.roundId.split('-')[0],
          roundId: data.roundId,
        },
      });
    }

    const result = await this.prisma.result.findFirst({
      where: {
        personId: data.competitorId,
        roundId: data.roundId,
      },
      select: {
        id: true,
        person: {
          select: {
            registrantId: true,
          },
        },
      },
    });

    await this.prisma.attempt.create({
      data: {
        attemptNumber: data.attemptNumber,
        value: data.value,
        penalty: data.penalty,
        solvedAt: new Date(),
        device: {
          connect: {
            id: data.deviceId,
          },
        },
        judge: {
          connect: {
            id: data.judgeId,
          },
        },
        replacedBy: data.replacedBy ? data.replacedBy : null,
        status: data.status,
        comment: data.comment,
        result: {
          connect: {
            id: result.id,
          },
        },
      },
    });

    if (data.submitToWcaLive) {
      const competition = await this.prisma.competition.findFirst();
      await this.wcaService.enterAttemptToWcaLive(
        competition.wcaId,
        competition.scoretakingToken,
        data.roundId.split('-')[0],
        parseInt(data.roundId.split('-r')[1]),
        result.person.registrantId,
        data.attemptNumber,
        data.penalty * 100 + data.value,
      );
    }
    return {
      message: 'Attempt created successfully',
    };
  }

  async swapAttempts(attemptId: string, secondAttemptId: string) {
    const firstAttempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
    });
    const secondAttempt = await this.prisma.attempt.findUnique({
      where: { id: secondAttemptId },
    });

    await this.prisma.attempt.update({
      where: { id: attemptId },
      data: {
        attemptNumber: secondAttempt.attemptNumber,
      },
    });
    await this.prisma.attempt.update({
      where: { id: secondAttemptId },
      data: {
        attemptNumber: firstAttempt.attemptNumber,
      },
    });
    return {
      message: 'Attempts swapped successfully',
    };
  }

  async updateAttempt(id: string, data: UpdateAttemptDto) {
    if (data.status !== AttemptStatus.EXTRA_GIVEN || data.replacedBy === 0) {
      data.replacedBy = null;
    }
    const dataToUpdate = {
      attemptNumber: data.attemptNumber,
      replacedBy: data.replacedBy,
      penalty: data.penalty,
      status: data.status,
      value: data.value,
      comment: data.comment,
    };
    if (data.judgeId) {
      dataToUpdate['judge'] = {
        connect: {
          id: data.judgeId,
        },
      };
    } else {
      dataToUpdate['judgeId'] = null;
    }
    const attempt = await this.prisma.attempt.update({
      where: { id: id },
      data: dataToUpdate,
      select: {
        id: true,
        result: {
          select: {
            roundId: true,
            person: {
              select: {
                registrantId: true,
              },
            },
          },
        },
      },
    });
    this.incidentsGateway.handleAttemptUpdated();
    if (!attempt) {
      throw new HttpException('Attempt not found', 404);
    }
    if (
      data.submitToWcaLive &&
      data.status !== AttemptStatus.EXTRA_GIVEN &&
      !data.replacedBy
    ) {
      const competition = await this.prisma.competition.findFirst();
      const roundId = attempt.result.roundId;
      const timeToEnterAttemptToWcaLive =
        data.penalty === -1 ? -1 : data.penalty * 100 + data.value;
      await this.wcaService.enterAttemptToWcaLive(
        competition.wcaId,
        competition.scoretakingToken,
        roundId.split('-')[0],
        parseInt(roundId.split('-r')[1]),
        attempt.result.person.registrantId,
        data.attemptNumber,
        timeToEnterAttemptToWcaLive,
      );
      return attempt;
    }
  }

  async deleteAttempt(id: string) {
    return this.prisma.attempt.delete({
      where: { id: id },
    });
  }

  async getAttemptById(id: string) {
    return this.prisma.attempt.findUnique({
      where: { id },
      select: {
        id: true,
        resultId: true,
        attemptNumber: true,
        replacedBy: true,
        penalty: true,
        comment: true,
        inspectionTime: true,
        status: true,
        value: true,
        solvedAt: true,
        createdAt: true,
        judgeId: true,
        judge: {
          select: {
            id: true,
            registrantId: true,
            wcaId: true,
            name: true,
          },
        },
        device: {
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
  }

  async getUnresolvedAttempts() {
    return this.prisma.attempt.findMany({
      where: { status: AttemptStatus.UNRESOLVED },
      select: {
        id: true,
        resultId: true,
        attemptNumber: true,
        replacedBy: true,
        status: true,
        penalty: true,
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
        device: {
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
  }
}
