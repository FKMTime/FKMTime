import { DbService } from '../db/db.service';
import { HttpException, Injectable } from '@nestjs/common';
import { UpdateAttemptDto } from './dto/updateAttempt.dto';
import { CreateAttemptDto } from './dto/createAttempt.dto';
import { IncidentsGateway } from './incidents.gateway';
import { AttemptStatus } from '@prisma/client';
import { WcaService } from '../wca/wca.service';
import { ResultService } from '../result/result.service';

@Injectable()
export class AttemptService {
  constructor(
    private readonly prisma: DbService,
    private readonly wcaService: WcaService,
    private readonly incidentsGateway: IncidentsGateway,
    private readonly resultService: ResultService,
  ) {}

  async createAttempt(data: CreateAttemptDto) {
    const result = await this.resultService.getResultOrCreate(
      data.competitorId,
      data.roundId,
    );

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
        attemptNumber: true,
        result: {
          select: {
            roundId: true,
            person: {
              select: {
                id: true,
                registrantId: true,
              },
            },
          },
        },
      },
    });
    if (data.updateReplacedBy) {
      const attemptToReplace = await this.prisma.attempt.findFirst({
        where: {
          status: AttemptStatus.EXTRA_GIVEN,
          replacedBy: null,
        },
        select: {
          id: true,
        },
      });
      if (attemptToReplace) {
        await this.prisma.attempt.update({
          where: { id: attemptToReplace.id },
          data: {
            replacedBy: attempt.attemptNumber,
          },
        });
      }
    }
    this.incidentsGateway.handleAttemptUpdated();
    if (!attempt) {
      throw new HttpException('Attempt not found', 404);
    }
    if (data.submitToWcaLive) {
      const result = await this.resultService.getResultOrCreate(
        attempt.result.person.id,
        attempt.result.roundId,
      );
      await this.wcaService.enterWholeScorecardToWcaLive(result);
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
        result: {
          include: {
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
        result: {
          include: {
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
