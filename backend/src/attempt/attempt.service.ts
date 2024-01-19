import { DbService } from '../db/db.service';
import { Injectable } from '@nestjs/common';
import { UpdateAttemptDto } from './dto/updateAttempt.dto';

@Injectable()
export class AttemptService {
  constructor(private readonly prisma: DbService) {}

  async updateAttempt(id: number, data: UpdateAttemptDto) {
    return await this.prisma.attempt.update({
      where: { id: id },
      data: data,
    });
  }
  async deleteAttempt(id: number) {
    return await this.prisma.attempt.delete({
      where: { id: id },
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
