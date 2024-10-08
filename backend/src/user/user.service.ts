import { HttpException, Injectable } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { sha512 } from 'js-sha512';
import { WcaService } from 'src/wca/wca.service';

import { DbService } from '../db/db.service';
import { CreateUserDto } from './dto/createUser.dto';
import { UpdateUserDto } from './dto/updateUser.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: DbService,
    private readonly wcaService: WcaService,
  ) {}

  async getAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        wcaUserId: true,
        isWcaAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        username: 'asc',
      },
    });
  }

  async createUser(data: CreateUserDto) {
    if (data.wcaId) {
      const userInfo = await this.wcaService.getUserInfoByWcaId(data.wcaId);
      await this.prisma.user.create({
        data: {
          fullName: data.fullName,
          wcaUserId: userInfo.user.id,
          role: data.role,
        },
      });
      return {
        message: 'User created successfully',
      };
    }
    if (data.username && !data.password) {
      throw new HttpException('Password is required', 400);
    }
    try {
      await this.prisma.user.create({
        data: {
          username: data.username ? data.username : null,
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
      message: 'User created successfully',
    };
  }

  async updateUser(id: string, data: UpdateUserDto) {
    try {
      await this.prisma.user.update({
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
      message: 'User updated successfully',
    };
  }

  async updatePassword(id: string, password: string) {
    return this.prisma.user.update({
      where: { id: id },
      data: {
        password: sha512(password),
      },
    });
  }

  async deleteUser(id: string) {
    return this.prisma.user.delete({
      where: { id: id },
    });
  }
}
