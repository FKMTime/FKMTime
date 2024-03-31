import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { sha512 } from 'js-sha512';
import { DbService } from '../db/db.service';
import { JwtAuthDto } from './dto/jwt-auth.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: DbService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.account.findFirst({
      where: { username: dto.username },
    });

    if (!user || (user && !(sha512(dto.password) === user.password))) {
      throw new HttpException('Wrong credentials!', 403);
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
