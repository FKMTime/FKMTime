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
  AttemptStatus,
  AttemptType,
  H2hBracketStatus,
  H2hMatchEnd,
  H2hMatchStatus,
  H2hSide,
  Prisma,
} from '../generated/prisma/client';
import { labelOfMatch, lockBracket } from './bracketStore';
import {
  MatchConflict,
  nextScramble,
  placeAttempt,
  scoreMatch,
  ScrambleSetOption,
  WAITING_FOR_OPPONENT,
} from './matchEngine';
import { finishMatch, playingMatchOf, resolveWalkovers } from './matchStore';
import { SlotState, stationOutcome } from './stationText';

type Db = Prisma.TransactionClient;

export const NO_MATCH_IN_PROGRESS = 'No match in progress';

/** How far ahead a station's clock may run of the server's */
const STATION_CLOCK_TOLERANCE_MS = 60_000;

/**
 * Why an attempt has nowhere to go in its match, as the station shows it:
 * `key` is the reply text's translation key, the message what manual entry
 * shows
 */
export type H2hRefusalKey =
  | 'h2hNoMatchInProgress'
  | 'h2hWaitingForOpponent'
  | 'h2hWaitingForDelegate'
  | 'h2hNoScrambleLeft'
  /** A station's queued solve that was typed in by hand meanwhile */
  | 'attemptAlreadyEntered';

export class H2hRefusal extends ConflictException {
  constructor(
    readonly key: H2hRefusalKey,
    message: string,
  ) {
    super(message);
  }
}

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
      h2hPointExtra: { select: { id: true } },
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
    // Raced on a point, or on one that was given an extra since
    used: s.h2hPoint !== null || s.h2hPointExtra !== null,
  })),
});

const attemptResultSelect = {
  id: true,
  attemptNumber: true,
  value: true,
  penalty: true,
  status: true,
  sessionId: true,
  solvedAt: true,
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

/**
 * An attempt's result as scoring reads it. One with an open incident
 * decides nothing until the delegate resolves it: it may still get an extra.
 */
const resultOf = (
  attempt: Pick<Attempt, 'value' | 'penalty' | 'status'> | null,
) =>
  attempt === null || attempt.status === AttemptStatus.UNRESOLVED
    ? null
    : toAttemptResult(attempt);

const slotState = (attempt: Pick<Attempt, 'status'> | null): SlotState =>
  attempt === null
    ? 'empty'
    : attempt.status === AttemptStatus.UNRESOLVED
      ? 'incident'
      : 'in';

/**
 * Runs head-to-head matches (SPEC-001): starting one, recording attempts
 * into its points, and deciding points, sets and the match as they come in.
 * Manual entry and stations record through here.
 */
@Injectable()
export class H2hMatchService {
  constructor(
    private readonly prisma: DbService,
    @Inject(forwardRef(() => AppGateway))
    private readonly appGateway: AppGateway,
  ) {}

  private labelOf(db: Db, bracketId: string, matchId: string) {
    return labelOfMatch(db, bracketId, matchId);
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
      // Seeds lock with the first start, so an empty seed then stays empty
      // and the match it belongs to can never be played
      const bracket = await tx.db.h2hBracket.findUniqueOrThrow({
        where: { id: bracketId },
        select: {
          status: true,
          size: true,
          _count: { select: { entrants: true } },
        },
      });
      if (bracket.status === H2hBracketStatus.DRAFT) {
        throw new ConflictException(
          `Fill every seed before the first match starts: ${bracket._count.entrants} of ${bracket.size} have a competitor`,
        );
      }
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
   * writes the attempt with the number it gets, 1..N per competitor across
   * the round, and its type: an extra when it races a point again after an
   * extra was granted on it. Then decides whatever the attempt completes.
   * `replaced` is the attempt the extra replaces, now pointing at it.
   */
  async recordAttempt<T extends { id: string; attemptNumber: number }>(
    tx: Tx,
    input: {
      roundId: string;
      personId: string;
      resultId: string;
      create: (attemptNumber: number, type: AttemptType) => Promise<T>;
      /**
       * A station's solve: refused when the competitor's last attempt in
       * the match was typed in by hand, after this solve, with the same
       * result. The station queued it while offline, and a delegate
       * entered it from the judge's paper.
       */
      fromStation?: { value: number; penalty: number; solvedAt: Date };
    },
  ): Promise<{
    attempt: T;
    matchId: string;
    pointId: string;
    side: H2hSide;
    replaced: Attempt | null;
  }> {
    const db = tx.db;
    // The whole round, before the match: finishing a match writes the
    // matches it feeds and the bracket, and new points draw on the round's
    // spare sets, so two matches recording at once must not interleave.
    // Same order as startMatch, so the two can't deadlock.
    await lockBracket(db, input.roundId);
    const playing = await playingMatchOf(db, input.roundId, input.personId);
    if (!playing) {
      throw new H2hRefusal('h2hNoMatchInProgress', NO_MATCH_IN_PROGRESS);
    }
    await lockMatch(db, playing.id);
    const match = await db.h2hMatch.findUniqueOrThrow({
      where: { id: playing.id },
      include: matchInclude,
    });
    // Finished while this request waited for the lock
    if (match.status !== H2hMatchStatus.IN_PROGRESS) {
      throw new H2hRefusal('h2hNoMatchInProgress', NO_MATCH_IN_PROGRESS);
    }
    const side =
      match.entrantA?.personId === input.personId ? H2hSide.A : H2hSide.B;
    if (input.fromStation) {
      const last = match.sets
        .flatMap((s) => s.points)
        .flatMap((point) => {
          const attempt = side === H2hSide.A ? point.attemptA : point.attemptB;
          return attempt ? [attempt] : [];
        })
        .sort((x, y) => y.attemptNumber - x.attemptNumber)[0];
      // Typed in: only a station sends a session id. The hand entry is
      // stamped when it is typed, so the solve it copies came before it,
      // give or take a station clock running ahead
      if (
        last &&
        last.sessionId === null &&
        last.solvedAt !== null &&
        input.fromStation.solvedAt.getTime() <=
          last.solvedAt.getTime() + STATION_CLOCK_TOLERANCE_MS &&
        // A DNF typed in has no time, a station's keeps the timer's
        toAttemptResult(last) === toAttemptResult(input.fromStation)
      ) {
        throw new H2hRefusal(
          'attemptAlreadyEntered',
          'This attempt has already been entered',
        );
      }
    }
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
      throw new H2hRefusal('h2hWaitingForOpponent', WAITING_FOR_OPPONENT);
    }
    if (placement.kind === 'new') {
      // A point with an open incident may still be raced again (an extra
      // for both), so the match waits for the delegate before moving on
      const incident = match.sets
        .flatMap((s) => s.points.map((point) => ({ s, point })))
        .find(({ point }) =>
          [point.attemptA, point.attemptB].some(
            (attempt) => attempt?.status === AttemptStatus.UNRESOLVED,
          ),
        );
      if (incident) {
        const label = await this.labelOf(db, match.bracket.id, match.id);
        throw new H2hRefusal(
          'h2hWaitingForDelegate',
          `${label}, set ${incident.s.setNumber}, point ${incident.point.pointNumber} has an open incident. Resolve it before the next point is raced.`,
        );
      }
    }
    const pointId =
      placement.kind === 'fill'
        ? set.points.find((p) => p.pointNumber === placement.pointNumber)?.id
        : await this.openPoint(db, match, set, placement.pointNumber);
    if (!pointId) throw new Error(`No point ${placement.pointNumber}`);
    // A point raced again after an extra: this side's last race on it is
    // what the new attempt replaces
    const lastExtra = await db.h2hPointExtra.findFirst({
      where: { pointId },
      orderBy: { createdAt: 'desc' },
    });
    const replacedId =
      lastExtra === null
        ? null
        : side === H2hSide.A
          ? lastExtra.attemptAId
          : lastExtra.attemptBId;

    const last = await db.attempt.aggregate({
      where: { resultId: input.resultId },
      _max: { attemptNumber: true },
    });
    const attempt = await input.create(
      (last._max.attemptNumber ?? 0) + 1,
      replacedId === null
        ? AttemptType.STANDARD_ATTEMPT
        : AttemptType.EXTRA_ATTEMPT,
    );
    await db.h2hPoint.update({
      where: { id: pointId },
      data:
        side === H2hSide.A
          ? { attemptAId: attempt.id }
          : { attemptBId: attempt.id },
    });
    const replaced =
      replacedId === null
        ? null
        : await db.attempt.update({
            where: { id: replacedId },
            data: { replacedBy: attempt.attemptNumber },
          });
    await this.settle(db, match.id);
    tx.afterCommit(() =>
      this.appGateway.handleH2hUpdated(match.bracket.roundId, match.id),
    );
    return { attempt, matchId: match.id, pointId, side, replaced };
  }

  /**
   * Where the match stands for the competitor on `side` after their attempt
   * landed on point `pointId`, for the station's reply
   */
  async stationOutcome(
    db: Db,
    matchId: string,
    pointId: string,
    side: H2hSide,
  ) {
    const match = await db.h2hMatch.findUniqueOrThrow({
      where: { id: matchId },
      select: {
        status: true,
        winnerSide: true,
        sets: {
          orderBy: { setNumber: 'asc' },
          select: {
            winnerSide: true,
            points: {
              orderBy: { pointNumber: 'asc' },
              select: {
                id: true,
                winnerSide: true,
                decidedAt: true,
                afterEnd: true,
                attemptA: { select: { status: true } },
                attemptB: { select: { status: true } },
              },
            },
          },
        },
      },
    });
    return stationOutcome(
      {
        status: match.status,
        winnerSide: match.winnerSide,
        sets: match.sets.map((set) => ({
          winnerSide: set.winnerSide,
          points: set.points.map((point) => ({
            id: point.id,
            winnerSide: point.winnerSide,
            decided: point.decidedAt !== null,
            afterEnd: point.afterEnd,
            a: slotState(point.attemptA),
            b: slotState(point.attemptB),
          })),
        })),
      },
      pointId,
      side,
    );
  }

  /** A new point of the set, on the next scramble nobody has raced */
  private async openPoint(
    db: Db,
    match: LoadedMatch,
    set: LoadedMatch['sets'][number],
    pointNumber: number,
  ) {
    const scrambleId = await this.pickScramble(db, match, set, pointNumber);
    const point = await db.h2hPoint.create({
      data: { setId: set.id, pointNumber, scrambleId },
    });
    return point.id;
  }

  /**
   * The next scramble nobody has raced, for a point of this set: its own
   * scramble set's, then a spare's; its next extra first for a point raced
   * again after an extra. Refused when none is left anywhere.
   */
  async pickScramble(
    db: Db,
    match: { id: string; bracket: { id: string; roundId: string } },
    set: { setNumber: number; scrambleSetId: string | null },
    pointNumber: number,
    options: { extra?: boolean } = {},
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
    const scramble = nextScramble(
      own && toOption(own),
      spares.map(toOption),
      options,
    );
    if (!scramble) {
      const label = await this.labelOf(db, match.bracket.id, match.id);
      const ownText = own ? `Set ${own.set} is used up and t` : 'T';
      throw new H2hRefusal(
        'h2hNoScrambleLeft',
        `${label}, set ${set.setNumber} has no scramble left for point ${pointNumber}. ${ownText}here is no spare set. Import more scramble sets for ${activityCodeToName(roundId)}.`,
      );
    }
    return scramble.id;
  }

  /**
   * Decides the match from its points again: every point's winner, each
   * set's and the match's. Opens the next set when one ends, finishes the
   * match and fills the matches it feeds. A finished match is frozen
   * (11l1): nothing here changes it.
   * When `reopening` a match on times amended after it, points raced after
   * their set or the match was over don't count rather than being refused:
   * they were raced, and the delegate can't take them back. They are marked
   * `afterEnd`. Later decisions accept those points after an end too, and
   * count one again once an edit means its set reaches it; any other point
   * after a set's end is refused as before.
   */
  async settle(db: Db, matchId: string, options: { reopening?: boolean } = {}) {
    const reopening = options.reopening ?? false;
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
            maySurplus: reopening || point.afterEnd,
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
        const afterEnd = scored?.afterEnd.has(point.pointNumber) ?? false;
        if (
          point.winnerSide === winnerSide &&
          (point.decidedAt !== null) === decided &&
          point.afterEnd === afterEnd
        ) {
          continue;
        }
        await db.h2hPoint.update({
          where: { id: point.id },
          data: { winnerSide, decidedAt: decided ? now : null, afterEnd },
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
      await finishMatch(
        db,
        { ...match, bracketId: match.bracket.id },
        score.winner,
        H2hMatchEnd.PLAYED,
      );
      // A competitor who withdrew may be waiting in a match this one feeds
      await resolveWalkovers(db, match.bracket.id);
    } else if (
      wanted !== null &&
      !unraced.some((set) => set.setNumber === wanted)
    ) {
      await this.openSet(db, match.id, wanted);
    }
  }

  /**
   * Opens a set on the scramble set its plan row has. A row left empty
   * opens it without one: it gets the set the row is given later (see
   * rematchScramblePlan), and until then its points take spare sets.
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
        set: {
          match: {
            bracketId: match.bracket.id,
            id: { not: match.id },
            // A walkover has no results (9f5b), as in bestSingles
            OR: [{ endedBy: null }, { endedBy: { not: H2hMatchEnd.WALKOVER } }],
          },
        },
        // Nor does a point raced after its set or match was over, as in
        // the match's own tie-breaks
        afterEnd: false,
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
   * The point an attempt was raced on, with its match locked, so call it
   * before changing the attempt; null for an attempt on no point
   */
  async lockPointOf(db: Db, attemptId: string) {
    const point = await this.pointOf(db, attemptId);
    if (!point) return null;
    // Round, then match: the order recordAttempt and startMatch take
    await lockBracket(db, point.set.match.bracket.roundId);
    await lockMatch(db, point.set.match.id);
    // Read again: it may have changed while this waited for the locks
    return this.pointOf(db, attemptId);
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
   * Takes an attempt off its point before it is deleted. Only the lone
   * attempt of a playing match's open point may go: nothing was decided
   * with it (a result typed for the wrong competitor). Anything else
   * decided a point, and deleting it is refused.
   * The point goes with it, unless it was given an extra: then it keeps its
   * extras and its scramble, and only the attempt's slot empties, so the
   * scrambles raced on it are never raced again (I4b1).
   * Returns the point, to settle its match once the attempt is gone, or
   * null for an attempt on no point.
   */
  async releaseFromPoint(db: Db, attemptId: string) {
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
      // It raced the point again after an extra: the attempt it replaced
      // waits for its extra again
      const deleted = await db.attempt.findUniqueOrThrow({
        where: { id: attemptId },
        select: { attemptNumber: true, resultId: true },
      });
      await db.attempt.updateMany({
        where: {
          resultId: deleted.resultId,
          replacedBy: deleted.attemptNumber,
          OR: [
            { h2hExtraAsA: { pointId: point.id } },
            { h2hExtraAsB: { pointId: point.id } },
          ],
        },
        data: { replacedBy: null },
      });
      const extras = await db.h2hPointExtra.count({
        where: { pointId: point.id },
      });
      if (extras > 0) {
        await db.h2hPoint.update({
          where: { id: point.id },
          data:
            point.attemptAId === attemptId
              ? { attemptAId: null }
              : { attemptBId: null },
        });
      } else {
        await db.h2hPoint.delete({ where: { id: point.id } });
      }
      return point;
    }
    throw new ConflictException(
      `This attempt was raced in ${where}, so it can't be deleted. Edit its time instead.`,
    );
  }

  /**
   * Where the first of these attempts was raced: on a point, or in a race a
   * point was given an extra for (`replaced`). Null for attempts on neither.
   */
  async findRace(db: Db, attemptIds: string[]) {
    if (attemptIds.length === 0) return null;
    const ids = { in: attemptIds };
    const pointSelect = {
      pointNumber: true,
      set: {
        select: {
          setNumber: true,
          match: { select: { id: true, bracketId: true } },
        },
      },
    } as const;
    const point = await db.h2hPoint.findFirst({
      where: { OR: [{ attemptAId: ids }, { attemptBId: ids }] },
      select: pointSelect,
    });
    const extra = point
      ? null
      : await db.h2hPointExtra.findFirst({
          where: { OR: [{ attemptAId: ids }, { attemptBId: ids }] },
          select: { point: { select: pointSelect } },
        });
    const raced = point ?? extra?.point;
    if (!raced) return null;
    const { match } = raced.set;
    const label = await this.labelOf(db, match.bracketId, match.id);
    return {
      label,
      setNumber: raced.set.setNumber,
      pointNumber: raced.pointNumber,
      replaced: point === null,
    };
  }

  /** Refuses deleting what has attempts raced on a point */
  async assertNotRaced(db: Db, attemptIds: string[], what: string) {
    const race = await this.findRace(db, attemptIds);
    if (!race) return;
    throw new ConflictException(
      `${what} can't be deleted: it has attempts raced in ${race.label}, set ${race.setNumber}.`,
    );
  }

  /**
   * Refuses reordering, swapping or replacing attempts raced on a point:
   * their numbers and extras follow the matches
   */
  async assertNotRenumbered(db: Db, attemptIds: string[]) {
    const race = await this.findRace(db, attemptIds);
    if (!race) return;
    throw new ConflictException(
      `Attempts raced in a head-to-head match keep the order of their points, so they can't be reordered, swapped or given another replacement (${race.label}, set ${race.setNumber}, point ${race.pointNumber}). For an extra, use Extra granted on the point in the Matches tab.`,
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
          { scrambles: { some: { h2hPointExtra: { isNot: null } } } },
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

  /**
   * People in the round's bracket with a match still to play or playing.
   * Someone who withdrew has none, even while their walkover waits for the
   * opponent.
   */
  async personsStillPlaying(db: Db, roundId: string) {
    const matches = await db.h2hMatch.findMany({
      where: {
        bracket: { roundId },
        status: { not: H2hMatchStatus.FINISHED },
      },
      select: {
        entrantA: { select: { personId: true, withdrawnAt: true } },
        entrantB: { select: { personId: true, withdrawnAt: true } },
      },
    });
    return new Set(
      matches.flatMap((m) =>
        [m.entrantA, m.entrantB].flatMap((entrant) =>
          entrant && entrant.withdrawnAt === null ? [entrant.personId] : [],
        ),
      ),
    );
  }

  /**
   * Each competitor's best single from their counting attempts, WCA-encoded.
   * Attempts in a walkover don't count: a match where one competitor
   * started no attempt has no results (9f5b).
   */
  async bestSingles(db: Db, roundId: string, personIds: string[]) {
    const [results, walkoverPoints] = await Promise.all([
      db.result.findMany({
        where: { roundId, personId: { in: personIds } },
        include: { attempts: true },
      }),
      db.h2hPoint.findMany({
        where: {
          set: {
            match: { bracket: { roundId }, endedBy: H2hMatchEnd.WALKOVER },
          },
        },
        select: {
          attemptAId: true,
          attemptBId: true,
          extras: { select: { attemptAId: true, attemptBId: true } },
        },
      }),
    ]);
    const inWalkovers = new Set(
      walkoverPoints.flatMap((point) =>
        [point, ...point.extras].flatMap((race) =>
          [race.attemptAId, race.attemptBId].filter(
            (id): id is string => id !== null,
          ),
        ),
      ),
    );
    return new Map(
      results.flatMap((result) => {
        const singles = getCountingAttempts(result.attempts)
          .filter((attempt) => !inWalkovers.has(attempt.id))
          .map(toAttemptResult);
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
