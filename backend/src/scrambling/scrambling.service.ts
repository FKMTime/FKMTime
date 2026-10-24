import { HttpException, Injectable } from '@nestjs/common';
import * as CryptoJS from 'crypto-js';
import { sha512 } from 'js-sha512';
import { DbService } from 'src/db/db.service';
import { PersonService } from 'src/person/person.service';
import { ResultService } from 'src/result/result.service';
import { ResultFromDeviceService } from 'src/result/resultFromDevice.service';

import { CreateScrambledAttemptDto } from './dto/createScrambledAttempt.dto';
import { UnlockScrambleSetDto } from './dto/unlockScrambleSet.dto';
@Injectable()
export class ScramblingService {
  constructor(
    private readonly prisma: DbService,
    private readonly personService: PersonService,
    private readonly resultFromDeviceService: ResultFromDeviceService,
    private readonly resultService: ResultService,
  ) {}

  async unlockScrambleSet(id: string, data: UnlockScrambleSetDto) {
    const set = await this.prisma.scrambleSet.findUnique({
      where: { id },
      include: { scrambles: true },
    });
    if (!set || set.scrambles.length === 0) {
      throw new HttpException('Scramble set not found', 404);
    }
    const exampleScramble = set.scrambles[0];
    let str: string;
    try {
      // A wrong password often decrypts to bytes that are not valid UTF-8,
      // which makes toString throw instead of returning garbage
      str = CryptoJS.AES.decrypt(
        exampleScramble.encryptedScramble,
        data.password,
      ).toString(CryptoJS.enc.Utf8);
    } catch {
      throw new HttpException('Invalid password', 403);
    }
    if (!str || !str.includes(' ')) {
      throw new HttpException('Invalid password', 403);
    }
    return set;
  }

  async getDeviceRoom(token: string) {
    const device = await this.verifyToken(token);
    return device.room;
  }

  async getScrambleData(token: string, cardId: string, roundId: string) {
    await this.verifyToken(token);
    return this.resultService.getNextAttemptData(cardId, roundId);
  }

  async getPersonDataByCardId(token: string, cardId: string) {
    await this.verifyToken(token);
    const person = await this.personService.getPersonByCardId(cardId);
    if (!person) {
      throw new HttpException('Person not found', 404);
    }
    return person;
  }

  async createScrambledAttempt(token: string, data: CreateScrambledAttemptDto) {
    await this.verifyToken(token);
    return await this.resultFromDeviceService.createScrambledAttempt(data);
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
