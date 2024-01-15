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
}
