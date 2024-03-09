import { DbService } from './../db/db.service';
import { Injectable } from '@nestjs/common';
import { UpdateAccountDto } from './dto/updateAccount.dto';
import { sha512 } from 'js-sha512';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: DbService) {}

  async getAllAccounts() {
    return this.prisma.account.findMany({
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

  async updateAccount(id: string, data: UpdateAccountDto) {
    return this.prisma.account.update({
      where: { id: id },
      data: {
        username: data.username,
        email: data.email,
        role: data.role,
      },
    });
  }

  async updatePassword(id: string, password: string) {
    return this.prisma.account.update({
      where: { id: id },
      data: {
        password: sha512(password),
      },
    });
  }

  async deleteAccount(id: string) {
    return this.prisma.account.delete({
      where: { id: id },
    });
  }

  async updateNotificationToken(userId: string, token: string) {
    return this.prisma.account.update({
      where: { id: userId },
      data: {
        notificationToken: token,
      },
    });
  }
}
