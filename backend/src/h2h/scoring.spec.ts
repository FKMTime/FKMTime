import { H2hSetDecision, H2hSide } from '@prisma/client';

import {
  decideMatch,
  decidePoint,
  decideSet,
  PlayedPoint,
  SetContext,
} from './scoring';

const DNF = -1;
const DNS = -2;

const point = (a: number, b: number): PlayedPoint => ({
  a,
  b,
  winner: decidePoint(a, b),
});

/** A set with no attempts outside it, between seeds 1 (A) and 2 (B) */
const set = (points: PlayedPoint[], extra: Partial<SetContext> = {}) => ({
  points,
  matchResults: {
    a: points.map((p) => p.a),
    b: points.map((p) => p.b),
  },
  roundResults: {
    a: points.map((p) => p.a),
    b: points.map((p) => p.b),
  },
  seeds: { a: 1, b: 2 },
  ...extra,
});

/** Seven points: A wins 2, B wins 2, three have no winner */
const sevenPointsTwoAll = (aFast: number, bFast: number) => [
  point(aFast, 1500),
  point(1500, bFast),
  point(900, 1000),
  point(1000, 900),
  point(DNF, DNS),
  point(DNF, DNF),
  point(1200, 1200),
];

describe('decidePoint', () => {
  it('gives the point to the faster time', () => {
    expect(decidePoint(1050, 1049)).toBe(H2hSide.B);
  });

  it('gives the point to a time over a DNF', () => {
    expect(decidePoint(DNF, 6000)).toBe(H2hSide.B);
  });

  it('gives no winner for two equal times', () => {
    expect(decidePoint(1234, 1234)).toBeNull();
  });

  it('gives no winner for DNF against DNS', () => {
    expect(decidePoint(DNF, DNS)).toBeNull();
  });

  it('gives no winner for two DNFs', () => {
    expect(decidePoint(DNF, DNF)).toBeNull();
  });
});

describe('decideSet', () => {
  it('gives the set to the first to 3 points', () => {
    const points = [
      point(900, 1000),
      point(1100, 1000),
      point(900, 1000),
      point(900, 1000),
    ];

    expect(decideSet(set(points))).toEqual({
      winner: H2hSide.A,
      decidedBy: H2hSetDecision.POINTS,
    });
  });

  it('keeps the set going on 2–2 after six points', () => {
    expect(decideSet(set(sevenPointsTwoAll(800, 800).slice(0, 6)))).toBeNull();
  });

  it('gives the set to more points won after 7 points with no one on 3', () => {
    const points = [
      point(900, 1000),
      point(900, 1000),
      point(1100, 1000),
      point(DNF, DNF),
      point(DNF, DNS),
      point(1000, 1000),
      point(DNS, DNS),
    ];

    expect(decideSet(set(points))).toEqual({
      winner: H2hSide.A,
      decidedBy: H2hSetDecision.MOST_POINTS,
    });
  });

  it('then gives it to the better single in the set', () => {
    expect(decideSet(set(sevenPointsTwoAll(800, 799)))).toEqual({
      winner: H2hSide.B,
      decidedBy: H2hSetDecision.BEST_IN_SET,
    });
  });

  it('then gives it to the better single in the match', () => {
    const points = sevenPointsTwoAll(800, 800);

    const outcome = decideSet(
      set(points, {
        matchResults: {
          a: [...points.map((p) => p.a), 750],
          b: [...points.map((p) => p.b), 760],
        },
      }),
    );

    expect(outcome).toEqual({
      winner: H2hSide.A,
      decidedBy: H2hSetDecision.BEST_IN_MATCH,
    });
  });

  it('then compares singles in the round past the best one', () => {
    const points = sevenPointsTwoAll(800, 800);
    const inSet = { a: points.map((p) => p.a), b: points.map((p) => p.b) };

    const outcome = decideSet(
      set(points, {
        roundResults: {
          a: [...inSet.a, 700, 850],
          b: [...inSet.b, 700, 840],
        },
      }),
    );

    expect(outcome).toEqual({
      winner: H2hSide.B,
      decidedBy: H2hSetDecision.BEST_IN_ROUND,
    });
  });

  it('counts a single missing from the round as the worst result', () => {
    const points = Array.from({ length: 7 }, () => point(1000, 1000));
    const inSet = points.map((p) => p.a);

    const outcome = decideSet(
      set(points, { roundResults: { a: inSet, b: [...inSet, 3000] } }),
    );

    expect(outcome).toEqual({
      winner: H2hSide.B,
      decidedBy: H2hSetDecision.BEST_IN_ROUND,
    });
  });

  it('gives it to the higher seed when nothing else separates them', () => {
    const points = sevenPointsTwoAll(800, 800);

    expect(decideSet(set(points, { seeds: { a: 7, b: 2 } }))).toEqual({
      winner: H2hSide.B,
      decidedBy: H2hSetDecision.SEED,
    });
  });
});

describe('decideMatch', () => {
  it('gives the match to the first to win the sets it needs', () => {
    expect(decideMatch([H2hSide.A, H2hSide.B, H2hSide.B], 2)).toBe(H2hSide.B);
  });

  it('keeps the match going until then', () => {
    expect(decideMatch([H2hSide.A, H2hSide.B], 2)).toBeNull();
  });
});
