/**
 * What a station shows after a solve in a head-to-head round (SPEC-001,
 * decision 6): a 16×2 LCD, ASCII only, where the first two words go on the
 * top line. "Point won" then "Set 2-1 Sets 1-0", from the competitor's side.
 */
import { H2hMatchStatus, H2hSide } from '../generated/prisma/client';
import { otherSide, placeAttempt, PointSlots } from './matchEngine';

/** Reply texts in the translation files */
export type H2hStationTextKey =
  | 'h2hPointWon'
  | 'h2hPointLost'
  | 'h2hNoPoint'
  | 'h2hMatchWon'
  | 'h2hMatchLost'
  | 'h2hWaitingForOpponent'
  | 'h2hWaitingForDelegate';

/** A slot of a point: no attempt, one with an open incident, or one in */
export type SlotState = 'empty' | 'incident' | 'in';

export interface OutcomePoint {
  id: string;
  winnerSide: H2hSide | null;
  decided: boolean;
  /** Raced after its set or the match was over: it doesn't count */
  afterEnd: boolean;
  a: SlotState;
  b: SlotState;
}

export interface OutcomeMatch {
  status: H2hMatchStatus;
  winnerSide: H2hSide | null;
  /** In set order */
  sets: { winnerSide: H2hSide | null; points: OutcomePoint[] }[];
}

export interface StationOutcome {
  /** Null while the match goes on */
  matchWon: boolean | null;
  point: 'won' | 'lost' | 'none' | 'waitingForOpponent' | 'waitingForDelegate';
  /** Points in the set the attempt was raced in */
  set: { mine: number; theirs: number };
  /** Sets in the match */
  sets: { mine: number; theirs: number };
}

const slotOf = (point: OutcomePoint, side: H2hSide) =>
  side === H2hSide.A ? point.a : point.b;

/**
 * Where the match stands for the competitor on `side`, right after their
 * attempt landed on point `pointId`
 */
export const stationOutcome = (
  match: OutcomeMatch,
  pointId: string,
  side: H2hSide,
): StationOutcome => {
  const set = match.sets.find((s) => s.points.some((p) => p.id === pointId));
  const point = set?.points.find((p) => p.id === pointId);
  if (!set || !point) throw new Error(`Point ${pointId} isn't in the match`);
  const count = (winners: (H2hSide | null)[], s: H2hSide) =>
    winners.filter((w) => w === s).length;
  const pointWinners = set.points
    .filter((p) => p.decided && !p.afterEnd)
    .map((p) => p.winnerSide);
  const setWinners = match.sets.map((s) => s.winnerSide);
  const theirSide = otherSide(side);
  const score = {
    set: {
      mine: count(pointWinners, side),
      theirs: count(pointWinners, theirSide),
    },
    sets: {
      mine: count(setWinners, side),
      theirs: count(setWinners, theirSide),
    },
  };
  const matchWon =
    match.status === H2hMatchStatus.FINISHED && match.winnerSide !== null
      ? match.winnerSide === side
      : null;
  if (matchWon !== null) {
    return { matchWon, point: pointResult(point, side), ...score };
  }
  if (!point.decided) {
    const theirs = slotOf(point, theirSide);
    return {
      matchWon,
      // Their attempt is in, but with an open incident (or this one is):
      // the delegate decides first
      point: theirs === 'empty' ? 'waitingForOpponent' : 'waitingForDelegate',
      ...score,
    };
  }
  return { matchWon, point: pointResult(point, side), ...score };
};

const pointResult = (point: OutcomePoint, side: H2hSide) =>
  !point.decided || point.winnerSide === null
    ? 'none'
    : point.winnerSide === side
      ? 'won'
      : 'lost';

const POINT_KEYS = {
  won: 'h2hPointWon',
  lost: 'h2hPointLost',
  none: 'h2hNoPoint',
  waitingForOpponent: 'h2hWaitingForOpponent',
  waitingForDelegate: 'h2hWaitingForDelegate',
} as const satisfies Record<StationOutcome['point'], H2hStationTextKey>;

/**
 * The reply text: "Point won Set 2-1 Sets 1-0", "Match lost Set 1-3 Sets
 * 0-2", or "Waiting for opponent". `scoreTemplate` is "Set {0} Sets {1}" in
 * the reader's language.
 */
export const h2hStationText = (
  outcome: StationOutcome,
  translate: (key: H2hStationTextKey) => string,
  scoreTemplate: string,
) => {
  const score = scoreTemplate
    .replace('{0}', `${outcome.set.mine}-${outcome.set.theirs}`)
    .replace('{1}', `${outcome.sets.mine}-${outcome.sets.theirs}`);
  if (outcome.matchWon !== null) {
    return `${translate(outcome.matchWon ? 'h2hMatchWon' : 'h2hMatchLost')} ${score}`;
  }
  if (
    outcome.point === 'waitingForOpponent' ||
    outcome.point === 'waitingForDelegate'
  ) {
    return translate(POINT_KEYS[outcome.point]);
  }
  return `${translate(POINT_KEYS[outcome.point])} ${score}`;
};

/**
 * The point a competitor plays next in the current set: their first empty
 * slot, or the point after their last. One who is a point ahead already
 * plays it once the opponent catches up.
 */
export const nextPointNumber = (points: PointSlots[], side: H2hSide) => {
  const placement = placeAttempt(points, side);
  if (placement.kind !== 'ahead') return placement.pointNumber;
  const mine = points.filter((p) => (side === H2hSide.A ? p.a : p.b)).length;
  return mine + 1;
};
