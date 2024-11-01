import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { activityCodeToName } from '@wca/helpers';
import { DbService } from 'src/db/db.service';

import { ImportScramblesDto } from './dto/import-scrambles.dto';

@Injectable()
export class ScrambleSetService {
  constructor(private readonly prisma: DbService) {}

  async importScrambles(data: ImportScramblesDto) {
    for (const set of data.scrambleSets) {
      try {
        await this.prisma.scrambleSet.create({
          data: {
            roundId: set.roundId,
            set: set.set,
            scrambles: {
              create: set.scrambles.map((scramble) => ({
                num: scramble.num,
                encryptedScramble: scramble.encryptedScramble,
                isExtra: scramble.isExtra,
              })),
            },
          },
        });
      } catch (e) {
        if (e.code === 'P2002') {
          throw new HttpException(
            `${activityCodeToName(set.roundId)} set ${set.set} has already been imported`,
            HttpStatus.BAD_REQUEST,
          );
        }
      }
      return {
        message: 'Scrambles imported successfully',
      };
    }
  }
}
