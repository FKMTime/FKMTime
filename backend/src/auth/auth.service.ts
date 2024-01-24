import { MailerService } from '@nestjs-modules/mailer';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthDto } from './dto/jwt-auth.dto';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { sha512 } from 'js-sha512';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: DbService,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
  ) {}

  async isTaken(username: string) {
    const user = await this.prisma.account.findFirst({
      where: { username: username },
    });
    return !!user;
  }

  async registerAccount(dto: RegisterDto): Promise<object> {
    if (await this.isTaken(dto.username)) {
      throw new HttpException('Username is already taken!', 400);
    }
    const randomString = this.generateRandomString(8);
    await this.prisma.account.create({
      data: {
        password: sha512(randomString),
        username: dto.username,
        email: dto.email,
        role: dto.role,
      },
    });

    const emailHTML = `
    <html lang="en">
      <body>
        <h1>SLSTime account</h1>
        <p>Username: ${dto.username}</p>
        <p>Password: ${randomString}</p>
      </body>
    </html>
  `;
    await this.mailerService.sendMail({
      to: dto.email,
      from: process.env.EMAIL_FROM,
      subject: 'Your SLSTime account',
      html: emailHTML,
    });

    return { msg: 'Successfully registered a new account!' };
  }

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

  async getUserPublicInfo(username: string): Promise<object | null> {
    return this.prisma.account.findUnique({
      where: {
        username,
      },
      select: {
        id: true,
        username: true,
        role: true,
      },
    });
  }

  async changePassword(
    userId: number,
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

  private generateRandomString(length: number) {
    let result = '';
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
  }

  async requireAdminRole(userId: number) {
    const user = await this.prisma.account.findFirst({
      where: {
        id: userId,
      },
    });
    if (user.role !== 'ADMIN') {
      throw new HttpException('Forbidden resource', 403);
    }
  }
}
