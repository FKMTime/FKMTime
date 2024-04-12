import { DbService } from '../db/db.service';
import { Injectable } from '@nestjs/common';
import { QuickActionDto } from './dto/quickAction.dto';
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
        wcaUserId: true,
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

  async getMyQuickActions(accountId: string) {
    return this.prisma.quickAction.findMany({
      where: { accountId },
    });
  }

  async createQuickAction(accountId: string, data: QuickActionDto) {
    return this.prisma.quickAction.create({
      data: {
        ...data,
        account: {
          connect: {
            id: accountId,
          },
        },
      },
    });
  }

  async updateQuickAction(
    accountId: string,
    quickActionId: string,
    data: QuickActionDto,
  ) {
    return this.prisma.quickAction.update({
      where: { id: quickActionId, accountId },
      data: data,
    });
  }

  async deleteQuickAction(accountId: string, quickActionId: string) {
    return this.prisma.quickAction.delete({
      where: { id: quickActionId, accountId },
    });
  }
}
