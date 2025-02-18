import { HttpException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
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
        roles: true,
        wcaUserId: true,
        createdAt: true,
        updatedAt: true,
        avatarUrl: true,
      },
      orderBy: {
        username: 'asc',
      },
    });
  }

  async createUser(data: CreateUserDto, userId: string) {
    const filteredRoles = await this.getFilteredRoles(userId, data.roles);
    if (filteredRoles.length !== data.roles.length) {
      throw new HttpException(
        'You cannot assign roles higher than your own',
        403,
      );
    }
    if (data.wcaId) {
      const userInfo = await this.wcaService.getUserInfoByWcaId(data.wcaId);
      await this.prisma.user.create({
        data: {
          fullName: data.fullName,
          wcaUserId: userInfo.user.id,
          roles: data.roles,
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
          roles: data.roles,
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

  async updateUser(id: string, data: UpdateUserDto, userId: string) {
    const filteredRoles = await this.getFilteredRoles(userId, data.roles);
    if (filteredRoles.length !== data.roles.length) {
      throw new HttpException(
        'You cannot assign roles higher than your own',
        403,
      );
    }
    try {
      await this.prisma.user.update({
        where: { id: id },
        data: {
          username: data.username,
          fullName: data.fullName,
          roles: data.roles,
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

  async getFilteredRoles(userId: string, roles: Role[]) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { roles: true },
    });
    if (!user) return [];
    if (user.roles.includes(Role.ADMIN)) return roles;
    if (user.roles.includes(Role.DELEGATE))
      return roles.filter((role) => role !== Role.ADMIN);
    if (
      user.roles.includes(Role.ORGANIZER) &&
      !user.roles.includes(Role.DELEGATE)
    )
      return roles.filter(
        (role) => role !== Role.ADMIN && role !== Role.DELEGATE,
      );
    else return [];
  }
}
