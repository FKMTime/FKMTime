import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { sha512 } from 'js-sha512';
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
      role: user.role,
    });

    return {
      token: jwt,
      userInfo: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  async loginWithWca(data: WcaLoginDto) {
    const ALWAYS_MANAGERS = ['wst', 'wrt', 'wcat'];
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
    if (existingUser) {
      await this.prisma.user.update({
        where: {
          id: existingUser.id,
        },
        data: {
          wcaAccessToken: token,
        },
      });
      const jwt = await this.generateAuthJwt({
        userId: existingUser.id,
        role: existingUser.role,
      });
      return {
        token: jwt,
        userInfo: {
          id: existingUser.id,
          username: existingUser.username,
          fullName: existingUser.fullName,
          role: existingUser.role,
          wcaAccessToken: token,
        },
      };
    } else {
      const competition = await this.prisma.competition.findFirst();
      const manageableCompetitions =
        await this.wcaService.getUpcomingManageableCompetitions(token);
      if (!competition) {
        return await this.createAndReturnUser(
          userInfo.me.id,
          userInfo.me.name,
          token,
        );
      } else {
        if (
          (manageableCompetitions.length === 0 ||
            !manageableCompetitions.some((c) => c.id === competition.wcaId)) &&
          !userInfo.me.teams.some((t) =>
            ALWAYS_MANAGERS.includes(t.friendly_id),
          )
        ) {
          throw new HttpException(
            'You are not allowed to manage this competition',
            403,
          );
        } else {
          return await this.createAndReturnUser(
            userInfo.me.id,
            userInfo.me.name,
            token,
          );
        }
      }
    }
  }

  async createAndReturnUser(
    wcaUserId: number,
    fullName: string,
    wcaAccessToken: string,
  ) {
    const user = await this.prisma.user.create({
      data: {
        wcaUserId: wcaUserId,
        fullName: fullName,
        role: 'ADMIN',
        wcaAccessToken: wcaAccessToken,
      },
    });
    const jwt = await this.generateAuthJwt({
      userId: user.id,
      role: user.role,
    });
    return {
      token: jwt,
      userInfo: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        wcaAccessToken: user.wcaAccessToken,
      },
    };
  }

  async generateAuthJwt(payload: JwtAuthDto): Promise<string> {
    return this.jwtService.sign(payload);
  }

  async validateJwt(token: string): Promise<JwtAuthDto> {
    return await this.jwtService.verifyAsync(token);
  }

  async getUserInfo(userId: string) {
    return this.prisma.user.findFirst({
      where: {
        id: userId,
      },
      select: {
        id: true,
        username: true,
        role: true,
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
