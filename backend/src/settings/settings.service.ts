import { DbService } from './../db/db.service';
import { Injectable } from '@nestjs/common';
import { UpdateSettingsDto } from './dto/updateSettings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: DbService) {}

  async getSettings(accountId: number) {
    return await this.prisma.account.findFirst({
      where: { id: accountId },
      select: {
        username: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
  async updateSettings(accountId: number, data: UpdateSettingsDto) {
    return await this.prisma.account.update({
      where: { id: accountId },
      data: data,
      select: {
        username: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
