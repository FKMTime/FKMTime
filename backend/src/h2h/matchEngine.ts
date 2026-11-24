/**
 * The pure parts of running a match (SPEC-001, Running a match on
 * competition day): where an attempt goes, which scramble a new point races,
 * and what the points so far decide. H2hMatchService reads and writes the
 * rows around them.
 */
import {
  H2hMatchEnd,
  H2hMatchStatus,
  H2hSetDecision,
  H2hSide,
} from '../generated/prisma/client';
import { decideMatch, decidePoint, decideSet, PlayedPoint } from './scoring';

export const WAITING_FOR_OPPONENT = "Waiting for opponent's result";

/** A refusal a person can act on; the service turns it into a 409 */
export class MatchConflict extends Error {}

export const otherSide = (side: H2hSide): H2hSide =>
  side === H2hSide.A ? H2hSide.B : H2hSide.A;

/** A point of the current set: which sides have an attempt in it */
export interface PointSlots {
  pointNumber: number;
  a: boolean;
  b: boolean;
}

export type Placement =
  | { kind: 'fill'; pointNumber: number }
  | { kind: 'new'; pointNumber: number }
  /** The competitor is a point ahead already: a second would be two */
  | { kind: 'ahead' };

/**
 * Where a competitor's next attempt goes in the current set: their first
 * empty slot, or a new point when every point has their attempt. A
 * competitor may be at most one point ahead of their opponent, so an
 * attempt that would put them two ahead has nowhere to go.
 */
export const placeAttempt = (
  points: PointSlots[],
  side: H2hSide,
): Placement => {
  const has = (point: PointSlots, s: H2hSide) =>
    s === H2hSide.A ? point.a : point.b;
  const mine = points.filter((point) => has(point, side)).length;
  const theirs = points.filter((point) => has(point, otherSide(side))).length;
  if (mine > theirs) return { kind: 'ahead' };
  const sorted = [...points].sort((x, y) => x.pointNumber - y.pointNumber);
  const empty = sorted.find((point) => !has(point, side));
  if (empty) return { kind: 'fill', pointNumber: empty.pointNumber };
  const last = sorted[sorted.length - 1];
  return { kind: 'new', pointNumber: last ? last.pointNumber + 1 : 1 };
};

export interface ScrambleOption {
  id: string;
  num: number;
  isExtra: boolean;
  /** Raced on a point already */
  used: boolean;
}

export interface ScrambleSetOption {
  id: string;
  /** The set's letter: "A", "B", … */
  set: string;
  scrambles: ScrambleOption[];
}

export interface ChosenScramble {
  id: string;
  num: number;
  isExtra: boolean;
  scrambleSetId: string;
  set: string;
  /** Taken from a set outside the plan, as the set's own ran out */
  fromSpare: boolean;
}

/** Normal scrambles in order, then extras in order */
const inRaceOrder = (scrambles: ScrambleOption[]) =>
  [...scrambles].sort(
    (x, y) => Number(x.isExtra) - Number(y.isExtra) || x.num - y.num,
  );

/** Letter order, shorter letters first, so "AA" comes after "Z" */
const byLetter = (x: ScrambleSetOption, y: ScrambleSetOption) =>
  x.set.length - y.set.length || x.set.localeCompare(y.set);

/**
 * The scramble a new point races: the next unused one of the H2H set's own
 * scramble set (normal scrambles, then extras), then of the first spare set
 * (one not in the plan). A point raced again after an extra takes the own
 * set's next extra first (Regulation 4b3: extra attempts use extra
 * scrambles). Null when none is left anywhere.
 */
export const nextScramble = (
  own: ScrambleSetOption | null,
  spares: ScrambleSetOption[],
  options: { extra?: boolean } = {},
): ChosenScramble | null => {
  const pick = (set: ScrambleSetOption, fromSpare: boolean) => {
    const scramble = inRaceOrder(set.scrambles).find((s) => !s.used);
    return scramble
      ? {
          id: scramble.id,
          num: scramble.num,
          isExtra: scramble.isExtra,
          scrambleSetId: set.id,
          set: set.set,
          fromSpare,
        }
      : null;
  };
  if (own && options.extra) {
    const extras = own.scrambles.filter((scramble) => scramble.isExtra);
    const fromExtras = pick({ ...own, scrambles: extras }, false);
    if (fromExtras) return fromExtras;
  }
  const fromOwn = own ? pick(own, false) : null;
  if (fromOwn) return fromOwn;
  for (const spare of [...spares].sort(byLetter)) {
    const fromSpare = pick(spare, true);
    if (fromSpare) return fromSpare;
  }
  return null;
};

/** A point as stored: each side's WCA-encoded result, or null while missing */
export interface ScoredPointInput {
  pointNumber: number;
  a: number | null;
  b: number | null;
}

export interface ScoredSetInput {
  setNumber: number;
  points: ScoredPointInput[];
}

export interface MatchInput {
  setsToWin: number;
  seeds: { a: number; b: number };
  /** The match's sets so far, in order */
  sets: ScoredSetInput[];
  /** Each side's results in the round's other matches */
  otherMatchResults: { a: number[]; b: number[] };
  /**
   * Points raced after their set was over, and sets raced after the match
   * was, don't count instead of being refused: reopening a match whose
   * times were amended (the 11l exception) can end a set earlier
   */
  ignoreSurplus?: boolean;
}

export interface SetScore {
  setNumber: number;
  /** Winners of the points with both attempts in, by point number */
  pointWinners: Map<number, H2hSide | null>;
  outcome: { winner: H2hSide; decidedBy: H2hSetDecision } | null;
  /**
   * With `ignoreSurplus`: the points raced after the set or the match was
   * over, which don't count. Empty otherwise.
   */
  afterEnd: Set<number>;
}

export interface MatchScore {
  sets: SetScore[];
  winner: H2hSide | null;
  /** The set to open next, when the last one is over and the match isn't */
  nextSetNumber: number | null;
}

const resultsOf = (sets: ScoredSetInput[], side: 'a' | 'b') =>
  sets.flatMap((set) =>
    set.points.flatMap((point) => (point[side] === null ? [] : [point[side]])),
  );

/**
 * What the match's points decide: every point's winner (I3c, I3d), each
 * set's (I3b, I3e) and the match's (I3a). Re-run after any attempt in an
 * unfinished match changes, so a typo fixed mid-match re-decides it.
 * Throws a MatchConflict when the points no longer fit the sets played:
 * points after a set would have ended (unless `ignoreSurplus`), or a set
 * started after one that would still be going on.
 */
export const scoreMatch = (input: MatchInput): MatchScore => {
  const sets: SetScore[] = [];
  input.sets.forEach((set, index) => {
    const isLast = index === input.sets.length - 1;
    const over = decideMatch(
      sets.map((s) => s.outcome?.winner ?? null),
      input.setsToWin,
    );
    if (over !== null && input.ignoreSurplus) {
      // Raced after the match was over: the set doesn't count
      sets.push({
        setNumber: set.setNumber,
        pointWinners: new Map(),
        outcome: null,
        afterEnd: new Set(set.points.map((point) => point.pointNumber)),
      });
      return;
    }
    const sorted = [...set.points].sort(
      (x, y) => x.pointNumber - y.pointNumber,
    );
    const pointWinners = new Map<number, H2hSide | null>();
    const played: PlayedPoint[] = [];
    const matchSoFar = input.sets.slice(0, index + 1);
    const matchResults = {
      a: resultsOf(matchSoFar, 'a'),
      b: resultsOf(matchSoFar, 'b'),
    };
    let outcome: SetScore['outcome'] = null;
    const afterEnd = new Set<number>();
    for (const [i, point] of sorted.entries()) {
      // Raced after the set was over: no winner, it doesn't count
      if (outcome && input.ignoreSurplus) {
        afterEnd.add(point.pointNumber);
        continue;
      }
      if (point.a === null || point.b === null) continue;
      const winner = decidePoint(point.a, point.b);
      pointWinners.set(point.pointNumber, winner);
      played.push({ a: point.a, b: point.b, winner });
      if (outcome) continue;
      outcome = decideSet({
        points: played,
        matchResults,
        roundResults: {
          a: [...input.otherMatchResults.a, ...matchResults.a],
          b: [...input.otherMatchResults.b, ...matchResults.b],
        },
        seeds: input.seeds,
      });
      if (outcome && i < sorted.length - 1 && !input.ignoreSurplus) {
        throw new MatchConflict(
          `Set ${set.setNumber} would be over after point ${point.pointNumber}, but point ${sorted[i + 1].pointNumber} has a result too. Check the times.`,
        );
      }
    }
    if (!outcome && !isLast) {
      throw new MatchConflict(
        `Set ${set.setNumber} would not be over yet, but set ${input.sets[index + 1].setNumber} has started. Check the times.`,
      );
    }
    sets.push({ setNumber: set.setNumber, pointWinners, outcome, afterEnd });
  });

  let winner: H2hSide | null = null;
  for (const [index, set] of sets.entries()) {
    winner = decideMatch(
      sets.slice(0, index + 1).map((s) => s.outcome?.winner ?? null),
      input.setsToWin,
    );
    // Sets raced after the match was over were left out above
    if (winner && input.ignoreSurplus) {
      return { sets, winner, nextSetNumber: null };
    }
    if (winner && index < sets.length - 1) {
      throw new MatchConflict(
        `The match would be over after set ${set.setNumber}, but set ${sets[index + 1].setNumber} has been played. Check the times.`,
      );
    }
  }
  const last = sets[sets.length - 1];
  return {
    sets,
    winner,
    nextSetNumber: winner === null && last?.outcome ? last.setNumber + 1 : null,
  };
};

/** A side of a match no one has started, as a withdrawal reads it */
export interface WalkoverSide {
  seed: number;
  withdrawnAt: Date | null;
}

/**
 * Who wins a match that hasn't started when a competitor in it has
 * withdrawn (I2h): the one still in. When both have, the one who left later
 * went further, so they win, and the higher seed when that is a tie too.
 * Null while neither has withdrawn.
 */
export const walkoverWinner = (
  a: WalkoverSide,
  b: WalkoverSide,
): H2hSide | null => {
  if (a.withdrawnAt === null && b.withdrawnAt === null) return null;
  if (a.withdrawnAt === null) return H2hSide.A;
  if (b.withdrawnAt === null) return H2hSide.B;
  const later = a.withdrawnAt.getTime() - b.withdrawnAt.getTime();
  if (later !== 0) return later > 0 ? H2hSide.A : H2hSide.B;
  return a.seed < b.seed ? H2hSide.A : H2hSide.B;
};

/** A match as reopening another one reads the graph */
export interface FedMatch {
  id: string;
  status: H2hMatchStatus;
  startedAt: Date | null;
  sourceAMatchId: string | null;
  sourceBMatchId: string | null;
}

/**
 * What reopening a match takes back: the matches it fed, and on through
 * the ones of those that finished as walkovers without starting. `started`
 * is one of them that has started, which makes reopening impossible: its
 * competitors are already playing on the old result.
 */
export const matchesFedBy = <T extends FedMatch>(
  matches: T[],
  matchId: string,
): { reset: T[]; started: T | null } => {
  const reset: T[] = [];
  const queue = [matchId];
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    const source = id;
    for (const fed of matches) {
      if (fed.sourceAMatchId !== source && fed.sourceBMatchId !== source) {
        continue;
      }
      if (fed.startedAt !== null) return { reset, started: fed };
      if (reset.includes(fed)) continue;
      reset.push(fed);
      if (fed.status === H2hMatchStatus.FINISHED) queue.push(fed.id);
    }
  }
  return { reset, started: null };
};

/** Why a finished match can't be reopened */
export type ReopenRefusal =
  /** A match it fed has started on its result */
  | { kind: 'fedStarted'; matchId: string }
  /**
   * A walkover that follows from a withdrawal in another match (or a
   * retirement there): that match is the one to reopen
   */
  | { kind: 'withdrewElsewhere'; entrantId: string; matchId: string | null };

/** A side of a finished match, as reopening reads it */
export interface WithdrawnSide {
  id: string;
  withdrawnAt: Date | null;
  withdrawnInMatchId: string | null;
}

/**
 * Why reopening a finished match is refused, or null when it can be. A
 * walkover or retirement is undone only in the match where it happened; a
 * played match leaves any later withdrawal of its loser alone.
 */
export const whyNoReopen = (
  match: FedMatch & {
    winnerSide: H2hSide | null;
    endedBy: H2hMatchEnd | null;
  },
  sides: { a: WithdrawnSide | null; b: WithdrawnSide | null },
  matches: FedMatch[],
): ReopenRefusal | null => {
  const { started } = matchesFedBy(matches, match.id);
  if (started) return { kind: 'fedStarted', matchId: started.id };
  if (match.endedBy === H2hMatchEnd.PLAYED || match.winnerSide === null) {
    return null;
  }
  const loser = match.winnerSide === H2hSide.A ? sides.b : sides.a;
  if (loser?.withdrawnAt && loser.withdrawnInMatchId !== match.id) {
    return {
      kind: 'withdrewElsewhere',
      entrantId: loser.id,
      matchId: loser.withdrawnInMatchId,
    };
  }
  return null;
};

/** An attempt's time as an edit log entry saved it */
export interface LoggedTime {
  editedAt: Date;
  value: number;
  penalty: number | null;
}

/**
 * Whether an attempt's time is no longer what it was when its match
 * finished: amended after the match, which keeps its winners (11l1)
 */
export const amendedAfter = (
  finishedAt: Date,
  logs: LoggedTime[],
  current: { value: number; penalty: number | null },
): boolean => {
  const atFinish = logs
    .filter((log) => log.editedAt.getTime() <= finishedAt.getTime())
    .sort((x, y) => x.editedAt.getTime() - y.editedAt.getTime())
    .at(-1);
  if (!atFinish) return false;
  return (
    atFinish.value !== current.value || atFinish.penalty !== current.penalty
  );
};
