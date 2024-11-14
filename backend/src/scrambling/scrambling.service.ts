import { HttpException, Injectable } from '@nestjs/common';
import * as CryptoJS from 'crypto-js';
import { DbService } from 'src/db/db.service';

import { UnlockScrambleSetDto } from './dto/unlockScrambleSet.dto';
@Injectable()
export class ScramblingService {
  constructor(private readonly prisma: DbService) {}

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
}
