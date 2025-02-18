import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { sha512 } from 'js-sha512';
import { ADMIN_WCA_USER_IDS } from 'src/constants';

import { DbService } from '../db/db.service';
import { WcaService } from '../wca/wca.service';
import { JwtAuthDto } from './dto/jwt-auth.dto';
import { LoginDto } from './dto/login.dto';
import { WcaLoginDto } from './dto/wcaLogin.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: DbService,
    private readonly jwtService: JwtService,
    private readonly wcaService: WcaService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { username: dto.username },
    });

    if (!user || (user && !(sha512(dto.password) === user.password))) {
      throw new HttpException('Wrong credentials!', 403);
    }

    if (user.wcaAccessToken) {
      throw new HttpException('Already logged in with WCA', 403);
    }

    const jwt = await this.generateAuthJwt({
      userId: user.id,
      roles: user.roles,
    });

    return {
      token: jwt,
      userInfo: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        roles: user.roles,
        avatarUrl: user.avatarUrl || undefined,
      },
    };
  }

  async loginWithWca(data: WcaLoginDto) {
    const token = await this.wcaService.getAccessToken(
      data.code,
      data.redirectUri,
    );
    if (token.hasOwnProperty('error') || !token) {
      throw new HttpException('Error logging in with WCA', 500);
    }
    const userInfo = await this.wcaService.getUserInfo(token);
    const existingUser = await this.prisma.user.findFirst({
      where: {
        wcaUserId: userInfo.me.id,
      },
    });
    const isDelegate = !!userInfo.me.delegate_status;

    if (existingUser) {
      await this.prisma.user.update({
        where: {
          id: existingUser.id,
        },
        data: {
          fullName: userInfo.me.name,
          wcaAccessToken: token,
          avatarUrl: userInfo.me.avatar.thumb_url,
        },
      });
      const jwt = await this.generateAuthJwt({
        userId: existingUser.id,
        roles: existingUser.roles,
      });
      return {
        token: jwt,
        userInfo: {
          id: existingUser.id,
          username: existingUser.username,
          fullName: existingUser.fullName,
          roles: existingUser.roles,
          wcaAccessToken: token,
          avatarUrl: userInfo.me.avatar.thumb_url,
        },
      };
    } else {
      const competition = await this.prisma.competition.findFirst();
      const manageableCompetitions =
        await this.wcaService.getUpcomingManageableCompetitions(token);
      const isGlobalAdmin = ADMIN_WCA_USER_IDS.includes(userInfo.me.id);
      if (!competition) {
        return await this.createAndReturnUser(
          userInfo.me.id,
          userInfo.me.name,
          token,
          Role.ADMIN,
          userInfo.me.avatar.thumb_url,
        );
      } else {
        if (
          manageableCompetitions.some((c) => c.id === competition.wcaId) ||
          isGlobalAdmin
        ) {
          return await this.createAndReturnUser(
            userInfo.me.id,
            userInfo.me.name,
            token,
            isGlobalAdmin
              ? Role.ADMIN
              : isDelegate
                ? Role.DELEGATE
                : Role.ORGANIZER,
          );
        } else {
          throw new HttpException(
            'You are not allowed to manage this competition',
            403,
          );
        }
      }
    }
  }

  async createAndReturnUser(
    wcaUserId: number,
    fullName: string,
    wcaAccessToken: string,
    role: Role,
    avatarUrl?: string,
  ) {
    const user = await this.prisma.user.create({
      data: {
        wcaUserId: wcaUserId,
        fullName: fullName,
        roles: [role],
        wcaAccessToken: wcaAccessToken,
        avatarUrl: avatarUrl,
      },
    });
    const jwt = await this.generateAuthJwt({
      userId: user.id,
      roles: user.roles,
    });
    return {
      token: jwt,
      userInfo: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        roles: user.roles,
        wcaAccessToken: user.wcaAccessToken,
      },
    };
  }

  async generateAuthJwt(payload: JwtAuthDto): Promise<string> {
    return this.jwtService.sign(payload);
  }

  async validateJwt(token: string): Promise<JwtAuthDto> {
    const verifiedUser = await this.jwtService.verifyAsync(token);
    const userFromDb = await this.prisma.user.findFirst({
      where: {
        id: verifiedUser.userId,
      },
    });
    return {
      userId: userFromDb.id,
      roles: userFromDb.roles,
    };
  }

  async userExists(userId: string) {
    return this.prisma.user.findFirst({
      where: {
        id: userId,
      },
    });
  }

  async getUserInfo(userId: string) {
    return this.prisma.user.findFirst({
      where: {
        id: userId,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        roles: true,
        wcaAccessToken: true,
        avatarUrl: true,
      },
    });
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
      },
    });
    if (sha512(oldPassword) !== user.password) {
      throw new HttpException('Wrong password', HttpStatus.FORBIDDEN);
    }
    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        password: sha512(newPassword),
      },
    });
    return 'Password changed';
  }
}
