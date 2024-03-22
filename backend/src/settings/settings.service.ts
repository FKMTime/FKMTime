import { DbService } from './../db/db.service';
import { Injectable } from '@nestjs/common';
import { UpdateSettingsDto } from './dto/updateSettings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: DbService) {}

  async getSettings(accountId: string) {
    return this.prisma.account.findFirst({
      where: { id: accountId },
      select: {
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
  async updateSettings(accountId: string, data: UpdateSettingsDto) {
    return this.prisma.account.update({
      where: { id: accountId },
      data: data,
      select: {
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
