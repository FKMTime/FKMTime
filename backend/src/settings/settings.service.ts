import { Injectable } from '@nestjs/common';

import { DbService } from '../db/db.service';
import { QuickActionDto } from './dto/quickAction.dto';
import { UpdateSettingsDto } from './dto/updateSettings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: DbService) {}

  async getSettings(userId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId },
      select: {
        username: true,
        role: true,
        wcaUserId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
  async updateSettings(userId: string, data: UpdateSettingsDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: data,
      select: {
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getMyQuickActions(userId: string) {
    return this.prisma.quickAction.findMany({
      where: { OR: [{ userId }, { isShared: true }] },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });
  }

  async createQuickAction(userId: string, data: QuickActionDto) {
    return this.prisma.quickAction.create({
      data: {
        ...data,
        user: {
          connect: {
            id: userId,
          },
        },
      },
    });
  }

  async updateQuickAction(
    userId: string,
    quickActionId: string,
    data: QuickActionDto,
  ) {
    return this.prisma.quickAction.update({
      where: { id: quickActionId, OR: [{ userId }, { isShared: true }] },
      data: data,
    });
  }

  async deleteQuickAction(userId: string, quickActionId: string) {
    return this.prisma.quickAction.delete({
      where: { id: quickActionId, OR: [{ userId }, { isShared: true }] },
    });
  }
}
