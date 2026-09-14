import { Injectable } from '@nestjs/common';
import { AttemptStatus, AttemptType } from '@prisma/client';
import { DbService } from 'src/db/db.service';

export interface AttemptSnapshot {
  id: string;
  value: number;
  penalty: number | null;
  status: AttemptStatus;
  type: AttemptType;
  attemptNumber: number;
  replacedBy: number | null;
  judgeId: string | null;
  scramblerId: string | null;
  deviceId: string | null;
  comment: string | null;
}

@Injectable()
export class AttemptEditLogService {
  constructor(private readonly prisma: DbService) {}

  async log(
    snapshot: AttemptSnapshot,
    editedAt: Date,
    editedById: string | null,
    logComment: string,
  ) {
    await this.prisma.attemptEditLog.create({
      data: {
        attemptId: snapshot.id,
        editedAt,
        editedById: editedById ?? undefined,
        comment: logComment,
        value: snapshot.value,
        penalty: snapshot.penalty,
        status: snapshot.status,
        type: snapshot.type,
        attemptNumber: snapshot.attemptNumber,
        replacedBy: snapshot.replacedBy,
        judgeId: snapshot.judgeId ?? undefined,
        scramblerId: snapshot.scramblerId ?? undefined,
        deviceId: snapshot.deviceId ?? undefined,
        attemptComment: snapshot.comment,
      },
    });
  }

  async getLogForAttempt(attemptId: string) {
    return this.prisma.attemptEditLog.findMany({
      where: { attemptId },
      orderBy: { editedAt: 'asc' },
      include: {
        editedBy: { select: { id: true, fullName: true, avatarUrl: true } },
        judge: { select: { id: true, name: true } },
        scrambler: { select: { id: true, name: true } },
        device: { select: { id: true, name: true } },
      },
    });
  }
}
