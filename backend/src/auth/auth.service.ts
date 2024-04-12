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
    const user = await this.prisma.account.findFirst({
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
    const token = await this.wcaService.getAccessToken(
      data.code,
      data.redirectUri,
    );
    if (token.hasOwnProperty('error') || !token) {
      throw new HttpException('Error logging in with WCA', 500);
    }
    const userInfo = await this.wcaService.getUserInfo(token);
    const existingUser = await this.prisma.account.findFirst({
      where: {
        wcaUserId: userInfo.me.id,
      },
    });
    if (existingUser) {
      await this.prisma.account.update({
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
        await this.createAndReturnAccount(
          userInfo.me.id,
          userInfo.me.name,
          token,
          true,
        );
      } else {
        if (
          manageableCompetitions.length === 0 ||
          !manageableCompetitions.some((c) => c.id === competition.wcaId)
        ) {
          throw new HttpException(
            'You are not allowed to manage this competition',
            403,
          );
        } else {
          return await this.createAndReturnAccount(
            userInfo.me.id,
            userInfo.me.name,
            token,
          );
        }
      }
    }
  }

  async createAndReturnAccount(
    wcaUserId: number,
    fullName: string,
    wcaAccessToken: string,
    competitionNotImported?: boolean,
  ) {
    const user = await this.prisma.account.create({
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
      competitionNotImported: competitionNotImported,
    };
  }

  async generateAuthJwt(payload: JwtAuthDto): Promise<string> {
    return this.jwtService.sign(payload);
  }

  async validateJwt(token: string): Promise<JwtAuthDto> {
    return await this.jwtService.verifyAsync(token);
  }

  async getAccountInfo(userId: string) {
    return this.prisma.account.findFirst({
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

  async validateApiToken(token: string): Promise<boolean> {
    const competition = await this.prisma.competition.findFirst({
      where: {
        apiToken: sha512(token),
      },
    });
    return !!competition;
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.account.findFirst({
      where: {
        id: userId,
      },
    });
    if (sha512(oldPassword) !== user.password) {
      throw new HttpException('Wrong password', HttpStatus.FORBIDDEN);
    }
    await this.prisma.account.update({
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
