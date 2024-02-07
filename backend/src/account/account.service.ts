import { DbService } from './../db/db.service';
import { Injectable } from '@nestjs/common';
import { UpdateAccountDto } from './dto/updateAccount.dto';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: DbService) {}

  async getAllAccounts() {
    return await this.prisma.account.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateAccount(id: number, data: UpdateAccountDto) {
    return await this.prisma.account.update({
      where: { id: id },
      data: {
        username: data.username,
        email: data.email,
        role: data.role,
      },
    });
  }

  async deleteAccount(id: number) {
    return await this.prisma.account.delete({
      where: { id: id },
    });
  }

  async updateNotificationToken(userId: number, token: string) {
    return await this.prisma.account.update({
      where: { id: userId },
      data: {
        notificationToken: token,
      },
    });
  }
}
