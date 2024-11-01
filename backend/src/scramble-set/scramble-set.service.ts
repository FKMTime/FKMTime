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
    }
    return {
      message: 'Scrambles imported successfully',
    };
  }

  async getScrambleSets(roundId: string) {
    const sets = await this.prisma.scrambleSet.findMany({
      where: {
        roundId,
      },
      include: {
        scrambles: true,
      },
    });
    return sets.map((set) => {
      return {
        ...set,
        scramblesCount: set.scrambles.filter((scramble) => !scramble.isExtra)
          .length,
        extraScramblesCount: set.scrambles.filter(
          (scramble) => scramble.isExtra,
        ).length,
        scrambles: undefined,
      };
    });
  }

  async deleteScrambleSet(id: string) {
    try {
      await this.prisma.scrambleSet.delete({
        where: {
          id,
        },
      });
    } catch (e) {
      if (e.code === 'P2016') {
        throw new HttpException('Scramble set not found', HttpStatus.NOT_FOUND);
      }
    }
    return {
      message: 'Scramble set deleted successfully',
    };
  }

  async deleteScrambleSetsByRoundId(roundId: string) {
    await this.prisma.scrambleSet.deleteMany({
      where: {
        roundId,
      },
    });
    return {
      message: 'Scramble sets deleted successfully',
    };
  }

  async deleteAllScrambleSets() {
    await this.prisma.scrambleSet.deleteMany();
    return {
      message: 'All scramble sets deleted successfully',
    };
  }
}
