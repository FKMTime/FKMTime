import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { activityCodeToName } from '@wca/helpers';
import { AppGateway } from 'src/app.gateway';
import { DbService } from 'src/db/db.service';
import { lockBracket, rematchScramblePlan } from 'src/h2h/bracketStore';
import { H2hMatchService } from 'src/h2h/h2hMatch.service';

import { ImportScramblesDto } from './dto/import-scrambles.dto';

@Injectable()
export class ScrambleSetService {
  constructor(
    private readonly prisma: DbService,
    private readonly h2hMatchService: H2hMatchService,
    @Inject(forwardRef(() => AppGateway))
    private readonly appGateway: AppGateway,
  ) {}

  /** A head-to-head round's plan may have changed (SPEC-001) */
  private planChanged(roundIds: Iterable<string>) {
    for (const roundId of new Set(roundIds)) {
      this.appGateway.handleH2hUpdated(roundId);
    }
  }

  async importScrambles(data: ImportScramblesDto) {
    // All or nothing: a duplicate set rolls back the sets imported before it
    await this.prisma.$transaction(
      async (tx) => {
        for (const set of data.scrambleSets) {
          try {
            await tx.scrambleSet.create({
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
            throw e;
          }
        }
        // New sets fill a head-to-head round's empty plan rows (SPEC-001)
        for (const roundId of new Set(
          data.scrambleSets.map((set) => set.roundId),
        )) {
          await rematchScramblePlan(tx, roundId);
        }
        // A whole competition's sets can take longer than the 5 s default
      },
      { timeout: 60_000 },
    );
    this.planChanged(data.scrambleSets.map((set) => set.roundId));
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

  /** Number of scramble sets per round, for rounds that have any */
  async getScrambleSetCounts() {
    const sets = await this.prisma.scrambleSet.findMany({
      select: { roundId: true },
    });
    const counts = new Map<string, number>();
    for (const { roundId } of sets) {
      counts.set(roundId, (counts.get(roundId) ?? 0) + 1);
    }
    return [...counts].map(([roundId, count]) => ({ roundId, count }));
  }

  async deleteScrambleSet(id: string) {
    const deleted = await this.prisma.$transaction(async (tx) => {
      const set = await tx.scrambleSet.findUnique({
        where: { id },
        select: { roundId: true },
      });
      // Before the delete clears its plan row, in the order a plan edit
      // takes them, so the two can't deadlock
      if (set) await lockBracket(tx, set.roundId);
      await this.h2hMatchService.assertSetsNotRaced(tx, [id]);
      // An unknown id throws P2025, which the global filter turns into a 404
      await tx.scrambleSet.delete({
        where: {
          id,
        },
      });
      // The plan row it was in takes a spare set, if there is one
      if (set) await rematchScramblePlan(tx, set.roundId);
      return set;
    });
    if (deleted) this.planChanged([deleted.roundId]);
    return {
      message: 'Scramble set deleted successfully',
    };
  }

  async deleteScrambleSetsByRoundId(roundId: string) {
    await this.prisma.$transaction(async (tx) => {
      await lockBracket(tx, roundId);
      const sets = await tx.scrambleSet.findMany({
        where: { roundId },
        select: { id: true },
      });
      await this.h2hMatchService.assertSetsNotRaced(
        tx,
        sets.map((set) => set.id),
      );
      await tx.scrambleSet.deleteMany({
        where: {
          roundId,
        },
      });
      await rematchScramblePlan(tx, roundId);
    });
    this.planChanged([roundId]);
    return {
      message: 'Scramble sets deleted successfully',
    };
  }

  async deleteAllScrambleSets() {
    const brackets = await this.prisma.$transaction(async (tx) => {
      const roundBrackets = await tx.h2hBracket.findMany({
        select: { roundId: true },
        orderBy: { roundId: 'asc' },
      });
      for (const { roundId } of roundBrackets) await lockBracket(tx, roundId);
      const sets = await tx.scrambleSet.findMany({ select: { id: true } });
      await this.h2hMatchService.assertSetsNotRaced(
        tx,
        sets.map((set) => set.id),
      );
      await tx.scrambleSet.deleteMany();
      for (const { roundId } of roundBrackets) {
        await rematchScramblePlan(tx, roundId);
      }
      return roundBrackets;
    });
    this.planChanged(brackets.map((bracket) => bracket.roundId));
    return {
      message: 'All scramble sets deleted successfully',
    };
  }

  async getScrambleSetById(id: string) {
    const set = await this.prisma.scrambleSet.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        roundId: true,
        set: true,
      },
    });
    if (!set) {
      throw new HttpException('Scramble set not found', HttpStatus.NOT_FOUND);
    }
    return set;
  }
}
