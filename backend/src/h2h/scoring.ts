import { H2hSetDecision, H2hSide } from '../generated/prisma/client';

/**
 * Attempt results in these functions are WCA-encoded, as toAttemptResult in
 * result/helpers gives them: centiseconds with +2s added, -1 for DNF, -2 for
 * DNS.
 */
type AttemptResult = number;

/** A set goes to the first to win this many points (I3b) */
export const POINTS_TO_WIN_SET = 3;
/** After this many points with no one on 3, the set goes to the tie-break (I3e) */
export const MAX_POINTS_IN_SET = 7;

/** DNF and DNS are both the worst result (I3c); null is no result at all */
const rank = (result: AttemptResult | null): number =>
  result !== null && result > 0 ? result : Infinity;

/** The side with the better result, or null when neither is better */
const better = (
  a: AttemptResult | null,
  b: AttemptResult | null,
): H2hSide | null => {
  if (rank(a) === rank(b)) return null;
  return rank(a) < rank(b) ? H2hSide.A : H2hSide.B;
};

const best = (results: AttemptResult[]): AttemptResult | null =>
  results.length === 0
    ? null
    : results.reduce((x, y) => (rank(x) <= rank(y) ? x : y));

/**
 * The point goes to the faster valid time. Two DNF or DNS results, or two
 * equal times, give no winner (I3c, I3d).
 */
export const decidePoint = (
  a: AttemptResult,
  b: AttemptResult,
): H2hSide | null => better(a, b);

/** A point with both attempts in */
export interface PlayedPoint {
  a: AttemptResult;
  b: AttemptResult;
  winner: H2hSide | null;
}

export interface SetContext {
  /** The set's points so far, in order; only points with both attempts in */
  points: PlayedPoint[];
  /** Every attempt of each side in the match so far, this set included */
  matchResults: { a: AttemptResult[]; b: AttemptResult[] };
  /** Every attempt of each side in the round so far, this match included */
  roundResults: { a: AttemptResult[]; b: AttemptResult[] };
  seeds: { a: number; b: number };
}

export interface SetOutcome {
  winner: H2hSide;
  decidedBy: H2hSetDecision;
}

/**
 * Sorted singles compared in order: best against best, then second best and
 * so on. A competitor with fewer attempts counts the missing ones as worst.
 * I3e doesn't say how to compare "single results in the round"; this is the
 * reading SPEC-001 agreed.
 */
const betterInRound = (
  a: AttemptResult[],
  b: AttemptResult[],
): H2hSide | null => {
  const sortedA = [...a].sort((x, y) => rank(x) - rank(y));
  const sortedB = [...b].sort((x, y) => rank(x) - rank(y));
  for (let i = 0; i < Math.max(sortedA.length, sortedB.length); i++) {
    const side = better(sortedA[i] ?? null, sortedB[i] ?? null);
    if (side !== null) return side;
  }
  return null;
};

/**
 * The set's winner, or null while it goes on. The first to 3 points wins it
 * (I3b). After 7 points with no one on 3, the first of these that separates
 * the two decides (I3e): more points in the set, the better single in the
 * set, in the match, then the better singles in the round, and last the
 * higher seed.
 */
export const decideSet = (set: SetContext): SetOutcome | null => {
  const won = (side: H2hSide) =>
    set.points.filter((point) => point.winner === side).length;
  const pointsA = won(H2hSide.A);
  const pointsB = won(H2hSide.B);
  if (pointsA >= POINTS_TO_WIN_SET) {
    return { winner: H2hSide.A, decidedBy: H2hSetDecision.POINTS };
  }
  if (pointsB >= POINTS_TO_WIN_SET) {
    return { winner: H2hSide.B, decidedBy: H2hSetDecision.POINTS };
  }
  if (set.points.length < MAX_POINTS_IN_SET) return null;

  const tieBreaks: [H2hSetDecision, () => H2hSide | null][] = [
    [
      H2hSetDecision.MOST_POINTS,
      () =>
        pointsA === pointsB ? null : pointsA > pointsB ? H2hSide.A : H2hSide.B,
    ],
    [
      H2hSetDecision.BEST_IN_SET,
      () =>
        better(
          best(set.points.map((point) => point.a)),
          best(set.points.map((point) => point.b)),
        ),
    ],
    [
      H2hSetDecision.BEST_IN_MATCH,
      () => better(best(set.matchResults.a), best(set.matchResults.b)),
    ],
    [
      H2hSetDecision.BEST_IN_ROUND,
      () => betterInRound(set.roundResults.a, set.roundResults.b),
    ],
    [
      H2hSetDecision.SEED,
      () =>
        set.seeds.a === set.seeds.b
          ? null
          : set.seeds.a < set.seeds.b
            ? H2hSide.A
            : H2hSide.B,
    ],
  ];
  for (const [decidedBy, decide] of tieBreaks) {
    const winner = decide();
    if (winner !== null) return { winner, decidedBy };
  }
  throw new Error('Two entrants of a bracket share a seed');
};

/** The match's winner once one side has won enough sets (I3a), else null */
export const decideMatch = (
  setWinners: (H2hSide | null)[],
  setsToWin: number,
): H2hSide | null => {
  const won = (side: H2hSide) =>
    setWinners.filter((winner) => winner === side).length;
  if (won(H2hSide.A) >= setsToWin) return H2hSide.A;
  if (won(H2hSide.B) >= setsToWin) return H2hSide.B;
  return null;
};
