import { HttpException, Injectable } from '@nestjs/common';
import * as CryptoJS from 'crypto-js';
import { sha512 } from 'js-sha512';
import { DbService } from 'src/db/db.service';
import { PersonService } from 'src/person/person.service';
import { ResultFromDeviceService } from 'src/result/resultFromDevice.service';

import { UnlockScrambleSetDto } from './dto/unlockScrambleSet.dto';
@Injectable()
export class ScramblingService {
  constructor(
    private readonly prisma: DbService,
    private readonly personService: PersonService,
    private readonly resultFromDeviceService: ResultFromDeviceService,
  ) {}

  async unlockScrambleSet(id: string, data: UnlockScrambleSetDto) {
    const set = await this.prisma.scrambleSet.findUnique({
      where: { id },
      include: { scrambles: true },
    });
    const exampleScramble = set.scrambles[0];
    const decryptedScramble = CryptoJS.AES.decrypt(
      exampleScramble.encryptedScramble,
      data.password,
    );
    if (!decryptedScramble) {
      throw new HttpException('Invalid password', 403);
    }
    const str = decryptedScramble.toString(CryptoJS.enc.Utf8);
    if (!str || !str.includes(' ')) {
      throw new HttpException('Invalid password', 403);
    }
    return set;
  }

  async getDeviceRoom(token: string) {
    const device = await this.verifyToken(token);
    return device.room;
  }

  async getScrambleData(token: string, cardId: string) {
    const device = await this.verifyToken(token);
    return this.resultFromDeviceService.getScrambleData(
      cardId,
      device.room.currentGroupId.split('-g')[0],
    );
  }

  private async verifyToken(token: string) {
    const scramblingDevice = await this.prisma.scramblingDevice.findFirst({
      where: { encryptedToken: sha512(token).toString() },
      include: { room: true },
    });
    if (!scramblingDevice) {
      throw new HttpException('Invalid token', 403);
    }
    return scramblingDevice;
  }
}
