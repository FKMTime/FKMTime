import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { DbService } from '../db/db.service';
import { HttpException, Injectable } from '@nestjs/common';
import { CreateAccountDto } from './dto/createAccount.dto';
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
        fullName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        username: 'asc',
      },
    });
  }

  async createAccount(data: CreateAccountDto) {
    try {
      await this.prisma.account.create({
        data: {
          username: data.username,
          fullName: data.fullName,
          password: sha512(data.password),
          role: data.role,
        },
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
          throw new HttpException('Username already taken', 409);
        }
      }
    }
    return {
      message: 'Account created successfully',
    };
  }

  async updateAccount(id: string, data: UpdateAccountDto) {
    try {
      await this.prisma.account.update({
        where: { id: id },
        data: {
          username: data.username,
          fullName: data.fullName,
          role: data.role,
        },
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
          throw new HttpException('Username already taken', 409);
        }
      }
    }
    return {
      message: 'Account updated successfully',
    };
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
}
