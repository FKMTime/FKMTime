import { HttpException, Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
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
    // Until a competition is imported, anyone who signs in with the WCA gets
    // a role (see AuthService.loginWithWca), so accounts made then could
    // outlive the import. Accounts can only be added once the instance is set up.
    const competition = await this.prisma.competition.findFirst({
      select: { id: true },
    });
    if (!competition) {
      throw new HttpException(
        'Import the competition before adding users',
        409,
      );
    }
    const filteredRoles = await this.getFilteredRoles(userId, data.roles);
    if (filteredRoles.length !== data.roles.length) {
      throw new HttpException(
        'You cannot assign roles higher than your own',
        403,
      );
    }
    if (data.wcaId) {
      const userInfo = await this.wcaService.getUserInfoByWcaId(data.wcaId);
      if (!userInfo?.user) {
        throw new HttpException('WCA user not found', 404);
      }
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
          password: await bcrypt.hash(data.password, 12),
          roles: data.roles,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
          throw new HttpException('Username already taken', 409);
        }
      }
      throw e;
    }
    return {
      message: 'User created successfully',
    };
  }

  async updateUser(id: string, data: UpdateUserDto, userId: string) {
    await this.assertCanManage(userId, id);
    const filteredRoles = await this.getFilteredRoles(userId, data.roles);
    const user = await this.prisma.user.findUnique({
      where: { id: id },
    });
    if (!user) {
      throw new HttpException('User not found', 404);
    }

    if (
      (!data.username || data.username.length === 0) &&
      user.wcaUserId === null
    ) {
      throw new HttpException({ message: ['Username must not be empty'] }, 400);
    }
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
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
          throw new HttpException('Username already taken', 409);
        }
      }
      throw e;
    }
    return {
      message: 'User updated successfully',
    };
  }

  async updatePassword(id: string, password: string, userId: string) {
    await this.assertCanManage(userId, id);
    await this.prisma.user.update({
      where: { id: id },
      data: { password: await bcrypt.hash(password, 12) },
    });
    return {
      message: 'Password updated successfully',
    };
  }

  async deleteUser(id: string, userId: string) {
    await this.assertCanManage(userId, id);
    return this.prisma.user.delete({
      where: { id: id },
      select: { id: true },
    });
  }

  /**
   * Refuses to act on a user who holds a role the caller could not grant,
   * so an organizer cannot reset, rename, demote or delete a delegate or an
   * admin, and a delegate cannot do it to an admin.
   */
  private async assertCanManage(userId: string, targetId: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { roles: true },
    });
    if (!target) {
      throw new HttpException('User not found', 404);
    }
    const allowed = await this.getFilteredRoles(userId, target.roles);
    if (allowed.length !== target.roles.length) {
      throw new HttpException(
        'You cannot change a user with roles higher than your own',
        403,
      );
    }
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
