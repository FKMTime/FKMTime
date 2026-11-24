import {
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { activityCodeToName } from '@wca/helpers';
import { AppGateway } from 'src/app.gateway';
import { DbService, runInTransaction, Tx } from 'src/db/db.service';
import { getCountingAttempts, toAttemptResult } from 'src/result/helpers';

import {
  Attempt,
  H2hBracketStatus,
  H2hMatchEnd,
  H2hMatchStatus,
  H2hOutcome,
  H2hSide,
  Prisma,
} from '../generated/prisma/client';
import { lockBracket, matchLabels } from './bracketStore';
import {
  MatchConflict,
  nextScramble,
  placeAttempt,
  scoreMatch,
  ScrambleSetOption,
  WAITING_FOR_OPPONENT,
} from './matchEngine';

type Db = Prisma.TransactionClient;

export const NO_MATCH_IN_PROGRESS = 'No match in progress';

/**
 * Serialises everything that records into one match, so two attempts at the
 * same moment can't both open point 3 or both miss that the set is over
 */
export const lockMatch = (db: Db, matchId: string) =>
  db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`h2h-match:${matchId}`}))`;

const scrambleOptionSelect = {
  id: true,
  set: true,
  scrambles: {
    select: {
      id: true,
      num: true,
      isExtra: true,
      h2hPoint: { select: { id: true } },
    },
  },
} as const;

type ScrambleSetRow = Prisma.ScrambleSetGetPayload<{
  select: typeof scrambleOptionSelect;
}>;

const toOption = (set: ScrambleSetRow): ScrambleSetOption => ({
  id: set.id,
  set: set.set,
  scrambles: set.scrambles.map((s) => ({
    id: s.id,
    num: s.num,
    isExtra: s.isExtra,
    used: s.h2hPoint !== null,
  })),
});

const attemptResultSelect = {
  id: true,
  value: true,
  penalty: true,
} as const;

/** A match with everything scoring it needs */
const matchInclude = {
  bracket: { select: { id: true, roundId: true } },
  entrantA: { select: { id: true, seed: true, personId: true } },
  entrantB: { select: { id: true, seed: true, personId: true } },
  sets: {
    orderBy: { setNumber: 'asc' },
    include: {
      points: {
        orderBy: { pointNumber: 'asc' },
        include: {
          attemptA: { select: attemptResultSelect },
          attemptB: { select: attemptResultSelect },
        },
      },
    },
  },
} as const satisfies Prisma.H2hMatchInclude;

type LoadedMatch = Prisma.H2hMatchGetPayload<{ include: typeof matchInclude }>;

const resultOf = (attempt: Pick<Attempt, 'value' | 'penalty'> | null) =>
  attempt === null ? null : toAttemptResult(attempt);

/**
 * Runs head-to-head matches (SPEC-001): starting one, recording attempts
 * into its points, and deciding points, sets and the match as they come in.
 * Manual entry calls in here now; stations will too.
 */
@Injectable()
export class H2hMatchService {
  constructor(
    private readonly prisma: DbService,
    @Inject(forwardRef(() => AppGateway))
    private readonly appGateway: AppGateway,
  ) {}

  private async labelOf(db: Db, bracketId: string, matchId: string) {
    const matches = await db.h2hMatch.findMany({
      where: { bracketId },
      select: { id: true, stage: true, matchNumber: true },
    });
    return matchLabels(matches).get(matchId) ?? 'This match';
  }

  /**
   * Starts a ready match: it becomes the two competitors' playing match, and
   * its set 1 opens on the scramble set the plan gives it
   */
  async startMatch(matchId: string) {
    return runInTransaction(this.prisma, async (tx) => {
      const found = await tx.db.h2hMatch.findUnique({
        where: { id: matchId },
        select: { bracket: { select: { id: true, roundId: true } } },
      });
      if (!found) throw new NotFoundException('Match not found');
      const { roundId, id: bracketId } = found.bracket;
      // Per round, so two starts can't both put one competitor in play
      await lockBracket(tx.db, roundId);
      await lockMatch(tx.db, matchId);
      const match = await tx.db.h2hMatch.findUniqueOrThrow({
        where: { id: matchId },
        include: {
          entrantA: { include: { person: { select: { name: true } } } },
          entrantB: { include: { person: { select: { name: true } } } },
          scrambleAssignments: { where: { setNumber: 1 } },
        },
      });
      const label = await this.labelOf(tx.db, bracketId, matchId);
      if (match.status === H2hMatchStatus.WAITING) {
        throw new ConflictException(
          `${label} can't start until both competitors are known`,
        );
      }
      if (match.status === H2hMatchStatus.IN_PROGRESS) {
        throw new ConflictException(`${label} is playing already`);
      }
      if (match.status === H2hMatchStatus.FINISHED) {
        throw new ConflictException(`${label} has finished`);
      }
      const { entrantA, entrantB } = match;
      if (!entrantA || !entrantB) {
        throw new ConflictException(
          `${label} can't start until both competitors are known`,
        );
      }
      for (const entrant of [entrantA, entrantB]) {
        const playing = await tx.db.h2hMatch.findFirst({
          where: {
            bracketId,
            status: H2hMatchStatus.IN_PROGRESS,
            OR: [{ entrantAId: entrant.id }, { entrantBId: entrant.id }],
          },
          select: { id: true },
        });
        if (playing) {
          const other = await this.labelOf(tx.db, bracketId, playing.id);
          throw new ConflictException(
            `${entrant.person.name} is playing ${other} already`,
          );
        }
      }
      const planned = match.scrambleAssignments[0]?.scrambleSetId ?? null;
      if (planned === null) {
        throw new ConflictException(
          `${label} has no scramble set for set 1. Import scrambles for ${activityCodeToName(roundId)}, or pick a set in the Scrambles tab.`,
        );
      }
      await tx.db.h2hSet.create({
        data: { matchId, setNumber: 1, scrambleSetId: planned },
      });
      await tx.db.h2hMatch.update({
        where: { id: matchId },
        data: { status: H2hMatchStatus.IN_PROGRESS, startedAt: new Date() },
      });
      await tx.db.h2hBracket.update({
        where: { id: bracketId },
        data: { status: H2hBracketStatus.IN_PROGRESS },
      });
      tx.afterCommit(() => this.appGateway.handleH2hUpdated(roundId, matchId));
      return { roundId };
    });
  }

  /**
   * Puts a new attempt into the competitor's playing match, in the same
   * transaction that creates it: the competitor's first empty slot of the
   * current set, or a new point on the next unused scramble. `create`
   * writes the attempt with the number it gets: 1..N per competitor across
   * the round. Then decides whatever the attempt completes.
   */
  async recordAttempt<T extends { id: string }>(
    tx: Tx,
    input: {
      roundId: string;
      personId: string;
      resultId: string;
      create: (attemptNumber: number) => Promise<T>;
    },
  ): Promise<{ attempt: T; matchId: string }> {
    const db = tx.db;
    const playing = await db.h2hMatch.findFirst({
      where: {
        bracket: { roundId: input.roundId },
        status: H2hMatchStatus.IN_PROGRESS,
        OR: [
          { entrantA: { personId: input.personId } },
          { entrantB: { personId: input.personId } },
        ],
      },
      select: { id: true },
    });
    if (!playing) throw new ConflictException(NO_MATCH_IN_PROGRESS);
    await lockMatch(db, playing.id);
    const match = await db.h2hMatch.findUniqueOrThrow({
      where: { id: playing.id },
      include: matchInclude,
    });
    // Finished while this request waited for the lock
    if (match.status !== H2hMatchStatus.IN_PROGRESS) {
      throw new ConflictException(NO_MATCH_IN_PROGRESS);
    }
    const side =
      match.entrantA?.personId === input.personId ? H2hSide.A : H2hSide.B;
    const set = match.sets.find((s) => s.winnerSide === null);
    if (!set) {
      throw new Error(`Match ${match.id} is playing with every set decided`);
    }
    const placement = placeAttempt(
      set.points.map((point) => ({
        pointNumber: point.pointNumber,
        a: point.attemptAId !== null,
        b: point.attemptBId !== null,
      })),
      side,
    );
    if (placement.kind === 'ahead') {
      throw new ConflictException(WAITING_FOR_OPPONENT);
    }
    const pointId =
      placement.kind === 'fill'
        ? set.points.find((p) => p.pointNumber === placement.pointNumber)?.id
        : await this.openPoint(db, match, set, placement.pointNumber);
    if (!pointId) throw new Error(`No point ${placement.pointNumber}`);

    const last = await db.attempt.aggregate({
      where: { resultId: input.resultId },
      _max: { attemptNumber: true },
    });
    const attempt = await input.create((last._max.attemptNumber ?? 0) + 1);
    await db.h2hPoint.update({
      where: { id: pointId },
      data:
        side === H2hSide.A
          ? { attemptAId: attempt.id }
          : { attemptBId: attempt.id },
    });
    await this.settle(db, match.id);
    tx.afterCommit(() =>
      this.appGateway.handleH2hUpdated(match.bracket.roundId, match.id),
    );
    return { attempt, matchId: match.id };
  }

  /** A new point of the set, on the next scramble nobody has raced */
  private async openPoint(
    db: Db,
    match: LoadedMatch,
    set: LoadedMatch['sets'][number],
    pointNumber: number,
  ) {
    const roundId = match.bracket.roundId;
    const own = set.scrambleSetId
      ? await db.scrambleSet.findUnique({
          where: { id: set.scrambleSetId },
          select: scrambleOptionSelect,
        })
      : null;
    // Spare: a set of the round that is neither planned nor any set's own
    const spares = await db.scrambleSet.findMany({
      where: { roundId, h2hPlan: { is: null }, h2hSet: { is: null } },
      select: scrambleOptionSelect,
    });
    const scramble = nextScramble(own && toOption(own), spares.map(toOption));
    if (!scramble) {
      const label = await this.labelOf(db, match.bracket.id, match.id);
      const ownText = own ? `Set ${own.set} is used up and t` : 'T';
      throw new ConflictException(
        `${label}, set ${set.setNumber} has no scramble left for point ${pointNumber}. ${ownText}here is no spare set. Import more scramble sets for ${activityCodeToName(roundId)}.`,
      );
    }
    const point = await db.h2hPoint.create({
      data: { setId: set.id, pointNumber, scrambleId: scramble.id },
    });
    return point.id;
  }

  /**
   * Decides the match from its points again: every point's winner, each
   * set's and the match's. Opens the next set when one ends, finishes the
   * match and fills the matches it feeds. A finished match is frozen
   * (11l1): nothing here changes it.
   */
  async settle(db: Db, matchId: string) {
    const match = await db.h2hMatch.findUniqueOrThrow({
      where: { id: matchId },
      include: matchInclude,
    });
    if (match.status !== H2hMatchStatus.IN_PROGRESS) return;
    const { entrantA, entrantB } = match;
    if (!entrantA || !entrantB) {
      throw new Error(`Match ${matchId} is playing without both competitors`);
    }
    // A set opened but not raced yet may have to close again after an edit
    const raced = match.sets.filter((set) => set.points.length > 0);
    const unraced = match.sets.filter((set) => set.points.length === 0);
    let score;
    try {
      score = scoreMatch({
        setsToWin: match.setsToWin,
        seeds: { a: entrantA.seed, b: entrantB.seed },
        sets: raced.map((set) => ({
          setNumber: set.setNumber,
          points: set.points.map((point) => ({
            pointNumber: point.pointNumber,
            a: resultOf(point.attemptA),
            b: resultOf(point.attemptB),
          })),
        })),
        otherMatchResults: await this.otherMatchResults(db, match),
      });
    } catch (e) {
      if (e instanceof MatchConflict) throw new ConflictException(e.message);
      throw e;
    }

    const now = new Date();
    for (const set of raced) {
      const scored = score.sets.find((s) => s.setNumber === set.setNumber);
      for (const point of set.points) {
        const decided = scored?.pointWinners.has(point.pointNumber) ?? false;
        const winnerSide = scored?.pointWinners.get(point.pointNumber) ?? null;
        if (
          point.winnerSide === winnerSide &&
          (point.decidedAt !== null) === decided
        ) {
          continue;
        }
        await db.h2hPoint.update({
          where: { id: point.id },
          data: { winnerSide, decidedAt: decided ? now : null },
        });
      }
      const outcome = scored?.outcome ?? null;
      if (
        set.winnerSide !== (outcome?.winner ?? null) ||
        set.decidedBy !== (outcome?.decidedBy ?? null)
      ) {
        await db.h2hSet.update({
          where: { id: set.id },
          data: {
            winnerSide: outcome?.winner ?? null,
            decidedBy: outcome?.decidedBy ?? null,
          },
        });
      }
    }

    // The set to play next, when the last raced one is over (or none is)
    const wanted =
      score.winner !== null
        ? null
        : (score.nextSetNumber ?? (raced.length === 0 ? 1 : null));
    const stale = unraced.filter((set) => set.setNumber !== wanted);
    if (stale.length > 0) {
      await db.h2hSet.deleteMany({
        where: { id: { in: stale.map((set) => set.id) } },
      });
    }
    if (score.winner !== null) {
      await this.finish(db, match, score.winner);
    } else if (
      wanted !== null &&
      !unraced.some((set) => set.setNumber === wanted)
    ) {
      await this.openSet(db, match.id, wanted);
    }
  }

  /**
   * Opens a set on the scramble set its plan row has. A row left empty
   * opens it without one, and its points take scrambles from spare sets.
   */
  private async openSet(db: Db, matchId: string, setNumber: number) {
    const row = await db.h2hScrambleAssignment.findUnique({
      where: { matchId_setNumber: { matchId, setNumber } },
    });
    const planned = row?.scrambleSetId ?? null;
    // The plan never gives one set to two rows, but a spare raced since
    // can't be opened again
    const taken =
      planned !== null &&
      (await db.h2hSet.count({ where: { scrambleSetId: planned } })) > 0;
    await db.h2hSet.create({
      data: { matchId, setNumber, scrambleSetId: taken ? null : planned },
    });
  }

  /** Each side's WCA-encoded results in the round's other matches */
  private async otherMatchResults(db: Db, match: LoadedMatch) {
    const points = await db.h2hPoint.findMany({
      where: {
        set: { match: { bracketId: match.bracket.id, id: { not: match.id } } },
      },
      include: {
        set: {
          select: {
            match: { select: { entrantAId: true, entrantBId: true } },
          },
        },
        attemptA: { select: attemptResultSelect },
        attemptB: { select: attemptResultSelect },
      },
    });
    const of = (entrantId: string | undefined) =>
      points.flatMap((point) => {
        const { entrantAId, entrantBId } = point.set.match;
        const attempt =
          entrantAId === entrantId
            ? point.attemptA
            : entrantBId === entrantId
              ? point.attemptB
              : null;
        return attempt ? [toAttemptResult(attempt)] : [];
      });
    return { a: of(match.entrantA?.id), b: of(match.entrantB?.id) };
  }

  /**
   * Ends the match and fills the matches it feeds with its winner and
   * loser; one with both sides known is ready to start
   */
  private async finish(db: Db, match: LoadedMatch, winner: H2hSide) {
    await db.h2hMatch.update({
      where: { id: match.id },
      data: {
        status: H2hMatchStatus.FINISHED,
        winnerSide: winner,
        endedBy: H2hMatchEnd.PLAYED,
        finishedAt: new Date(),
      },
    });
    const winnerId = winner === H2hSide.A ? match.entrantAId : match.entrantBId;
    const loserId = winner === H2hSide.A ? match.entrantBId : match.entrantAId;
    const pick = (outcome: H2hOutcome | null) =>
      outcome === H2hOutcome.LOSER ? loserId : winnerId;
    const fed = await db.h2hMatch.findMany({
      where: {
        OR: [{ sourceAMatchId: match.id }, { sourceBMatchId: match.id }],
      },
    });
    for (const next of fed) {
      const entrantAId =
        next.sourceAMatchId === match.id
          ? pick(next.sourceAOutcome)
          : next.entrantAId;
      const entrantBId =
        next.sourceBMatchId === match.id
          ? pick(next.sourceBOutcome)
          : next.entrantBId;
      await db.h2hMatch.update({
        where: { id: next.id },
        data: {
          entrantAId,
          entrantBId,
          ...(next.status === H2hMatchStatus.WAITING &&
            entrantAId !== null &&
            entrantBId !== null && { status: H2hMatchStatus.READY }),
        },
      });
    }
    const unfinished = await db.h2hMatch.count({
      where: {
        bracketId: match.bracket.id,
        status: { not: H2hMatchStatus.FINISHED },
      },
    });
    if (unfinished === 0) {
      await db.h2hBracket.update({
        where: { id: match.bracket.id },
        data: { status: H2hBracketStatus.FINISHED },
      });
    }
  }

  /**
   * The point an attempt was raced on, with its match locked, so call it
   * before changing the attempt; null for an attempt on no point
   */
  async lockPointOf(db: Db, attemptId: string) {
    const point = await this.pointOf(db, attemptId);
    if (point) await lockMatch(db, point.set.match.id);
    return point;
  }

  /** The point an attempt was raced on, with its set, match and round */
  async pointOf(db: Db, attemptId: string) {
    return db.h2hPoint.findFirst({
      where: { OR: [{ attemptAId: attemptId }, { attemptBId: attemptId }] },
      include: {
        set: {
          select: {
            id: true,
            setNumber: true,
            winnerSide: true,
            match: {
              select: {
                id: true,
                status: true,
                bracket: { select: { id: true, roundId: true } },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Whether an attempt on a point may be deleted. Only the lone attempt of a
   * playing match's open point may: nothing was decided with it, so the
   * point goes with it (a result typed for the wrong competitor). Anything
   * else decided a point, and deleting it is refused.
   * Returns the point to delete first, or null for an attempt on no point.
   */
  async pointToDeleteWith(db: Db, attemptId: string) {
    const point = await this.lockPointOf(db, attemptId);
    if (!point) return null;
    const { match } = point.set;
    const label = await this.labelOf(db, match.bracket.id, match.id);
    const where = `${label}, set ${point.set.setNumber}, point ${point.pointNumber}`;
    const alone = point.attemptAId === null || point.attemptBId === null;
    const later = await db.h2hPoint.count({
      where: { setId: point.set.id, pointNumber: { gt: point.pointNumber } },
    });
    if (
      match.status === H2hMatchStatus.IN_PROGRESS &&
      point.set.winnerSide === null &&
      alone &&
      later === 0
    ) {
      return point;
    }
    throw new ConflictException(
      `This attempt was raced in ${where}, so it can't be deleted. Edit its time instead.`,
    );
  }

  /** Refuses when any of these attempts was raced on a point */
  async assertNotRaced(db: Db, attemptIds: string[], what: string) {
    if (attemptIds.length === 0) return;
    const point = await db.h2hPoint.findFirst({
      where: {
        OR: [
          { attemptAId: { in: attemptIds } },
          { attemptBId: { in: attemptIds } },
        ],
      },
      include: {
        set: {
          select: {
            setNumber: true,
            match: {
              select: { id: true, bracket: { select: { id: true } } },
            },
          },
        },
      },
    });
    if (!point) return;
    const { match } = point.set;
    const label = await this.labelOf(db, match.bracket.id, match.id);
    throw new ConflictException(
      `${what} can't be deleted: it has attempts raced in ${label}, set ${point.set.setNumber}.`,
    );
  }

  /** Refuses deleting scramble sets a match has raced on */
  async assertSetsNotRaced(db: Db, scrambleSetIds: string[]) {
    if (scrambleSetIds.length === 0) return;
    const set = await db.scrambleSet.findFirst({
      where: {
        id: { in: scrambleSetIds },
        OR: [
          { h2hSet: { isNot: null } },
          { scrambles: { some: { h2hPoint: { isNot: null } } } },
        ],
      },
      select: { set: true },
    });
    if (set) {
      throw new ConflictException(
        `Set ${set.set} has been raced in a head-to-head match, so it can't be deleted`,
      );
    }
  }

  /** Each competitor's best single from their counting attempts, WCA-encoded */
  async bestSingles(db: Db, roundId: string, personIds: string[]) {
    const results = await db.result.findMany({
      where: { roundId, personId: { in: personIds } },
      include: { attempts: true },
    });
    return new Map(
      results.flatMap((result) => {
        const singles = getCountingAttempts(result.attempts).map(
          toAttemptResult,
        );
        if (singles.length === 0) return [];
        const solved = singles.filter((s) => s > 0);
        const best =
          solved.length > 0
            ? Math.min(...solved)
            : singles.includes(-1)
              ? -1
              : -2;
        return [[result.personId, best] as const];
      }),
    );
  }
}
