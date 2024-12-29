import { HttpException, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { sha512 } from 'js-sha512';
import { DbService } from 'src/db/db.service';

import { CheckTokenDto } from './dto/checkToken.dto';
import { GetTokenDto } from './dto/getToken.dto';
import { ScramblingDeviceDto } from './dto/scramblingDevice.dto';

@Injectable()
export class ScramblingDeviceService {
  constructor(private readonly prisma: DbService) {}

  async getScramblingDevicesByRoom() {
    return this.prisma.scramblingDevice.findMany({
      select: {
        id: true,
        name: true,
        room: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getScramblingDeviceByToken(token: string) {
    return this.prisma.scramblingDevice.findFirst({
      where: {
        encryptedToken: sha512(token),
      },
    });
  }

  async createScramblingDevice(data: ScramblingDeviceDto) {
    return this.prisma.scramblingDevice.create({
      data,
    });
  }

  async generateOneTimeCode(scramblingDeviceId: string) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const encryptedCode = sha512(code);
    await this.prisma.scramblingDevice.update({
      where: {
        id: scramblingDeviceId,
      },
      data: {
        encryptedOneTimeCode: encryptedCode,
      },
    });
    return {
      code,
    };
  }

  async getToken(data: GetTokenDto) {
    const scramblingDevice = await this.prisma.scramblingDevice.findFirst({
      where: {
        encryptedOneTimeCode: sha512(data.code),
      },
    });
    if (!scramblingDevice) {
      throw new HttpException('Not found', 404);
    }

    const token = crypto.randomBytes(32).toString('hex');
    await this.prisma.scramblingDevice.update({
      where: {
        id: scramblingDevice.id,
      },
      data: {
        encryptedToken: sha512(token),
        encryptedOneTimeCode: null,
      },
    });
    return {
      token,
      device: scramblingDevice,
    };
  }

  async validateToken(token: string) {
    const scramblingDevice = await this.prisma.scramblingDevice.findFirst({
      where: {
        encryptedToken: sha512(token),
      },
    });
    if (!scramblingDevice) {
      throw new HttpException('Not found', 404);
    }
    return scramblingDevice;
  }

  async isTokenValid(data: CheckTokenDto) {
    const scramblingDevice = await this.prisma.scramblingDevice.findFirst({
      where: {
        encryptedToken: sha512(data.token),
      },
    });
    return !!scramblingDevice;
  }

  async updateScramblingDevice(
    scramblingDeviceId: string,
    data: ScramblingDeviceDto,
  ) {
    return this.prisma.scramblingDevice.update({
      where: {
        id: scramblingDeviceId,
      },
      data,
    });
  }

  async deleteScramblingDevice(scramblingDeviceId: string) {
    try {
      await this.prisma.scramblingDevice.delete({
        where: {
          id: scramblingDeviceId,
        },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new HttpException('Not found', 404);
      }
    }
    return {
      message: 'Successfully deleted',
    };
  }
}
