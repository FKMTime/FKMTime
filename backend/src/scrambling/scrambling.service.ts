import { HttpException, Injectable } from '@nestjs/common';
import * as CryptoJS from 'crypto-js';
import { sha512 } from 'js-sha512';
import { DbService } from 'src/db/db.service';
import { H2hService } from 'src/h2h/h2h.service';
import { isH2hRound } from 'src/h2h/h2hRound';
import { PersonService } from 'src/person/person.service';
import { ResultService } from 'src/result/result.service';
import { ResultFromDeviceService } from 'src/result/resultFromDevice.service';
import { Competition } from 'wcif-helpers';

import { DeviceType } from '../generated/prisma/client';
import { CreateScrambledAttemptDto } from './dto/createScrambledAttempt.dto';
import { UnlockScrambleSetDto } from './dto/unlockScrambleSet.dto';
@Injectable()
export class ScramblingService {
  constructor(
    private readonly prisma: DbService,
    private readonly personService: PersonService,
    private readonly resultFromDeviceService: ResultFromDeviceService,
    private readonly resultService: ResultService,
    private readonly h2hService: H2hService,
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
    // Stations of this room pointed at another round, so the scrambling
    // device can scramble for it too (SPEC-007)
    const pointedStations = await this.prisma.device.findMany({
      where: {
        roomId: device.roomId,
        type: DeviceType.STATION,
        retiredAt: null,
        customRoundId: { not: null },
      },
      select: { name: true, customRoundId: true },
      orderBy: { name: 'asc' },
    });
    const stationRounds: { roundId: string; stationNames: string[] }[] = [];
    for (const { name, customRoundId } of pointedStations) {
      // The query only returns stations pointed at a round
      if (customRoundId === null) continue;
      const entry = stationRounds.find((r) => r.roundId === customRoundId);
      if (entry) entry.stationNames.push(name);
      else
        stationRounds.push({
          roundId: customRoundId,
          stationNames: [name],
        });
    }
    return { ...device.room, stationRounds };
  }

  async getScrambleData(token: string, cardId: string, roundId: string) {
    await this.verifyToken(token);
    await this.refuseH2hRound(roundId);
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
    await this.refuseH2hRound(data.roundId);
    return await this.resultFromDeviceService.createScrambledAttempt(data);
  }

  /**
   * Each playing match of a head-to-head round with the set in use and its
   * next point's scramble (SPEC-001, On the day): the scrambler picks a
   * match, unlocks that set and scrambles both cubes the same
   */
  async getH2hScrambles(token: string, roundId: string) {
    await this.verifyToken(token);
    if (!(await this.isH2hRound(roundId))) {
      throw new HttpException('This round is not head-to-head', 400);
    }
    return this.h2hService.getPlayingScrambles(roundId);
  }

  /**
   * A head-to-head point's scramble comes from its match, not from the
   * competitor's attempt count, and the point already knows it: no scan
   * per competitor (SPEC-001)
   */
  private async refuseH2hRound(roundId: string) {
    if (await this.isH2hRound(roundId)) {
      throw new HttpException(
        "In a head-to-head round, pick the match on the device's home screen: each point's scramble comes from its match, for both competitors.",
        400,
      );
    }
  }

  private async isH2hRound(roundId: string) {
    const competition = await this.prisma.competition.findFirst({
      select: { wcif: true },
    });
    return (
      competition !== null &&
      isH2hRound(
        roundId.split('-g')[0],
        competition.wcif as unknown as Competition,
      )
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
