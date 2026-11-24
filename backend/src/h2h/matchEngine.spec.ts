import { H2hSetDecision, H2hSide } from '../generated/prisma/client';
import {
  MatchConflict,
  MatchInput,
  nextScramble,
  placeAttempt,
  scoreMatch,
  ScrambleSetOption,
} from './matchEngine';

const { A, B } = H2hSide;

describe('placeAttempt', () => {
  it('opens point 1 in an empty set', () => {
    expect(placeAttempt([], A)).toEqual({ kind: 'new', pointNumber: 1 });
  });

  it("fills the competitor's slot of the point the opponent opened", () => {
    expect(placeAttempt([{ pointNumber: 1, a: false, b: true }], A)).toEqual({
      kind: 'fill',
      pointNumber: 1,
    });
  });

  it('opens the next point once every point has their attempt', () => {
    const points = [
      { pointNumber: 1, a: true, b: true },
      { pointNumber: 2, a: true, b: true },
    ];
    expect(placeAttempt(points, B)).toEqual({ kind: 'new', pointNumber: 3 });
  });

  it('lets a competitor go one point ahead', () => {
    const points = [{ pointNumber: 1, a: true, b: true }];
    expect(placeAttempt(points, A)).toEqual({ kind: 'new', pointNumber: 2 });
  });

  it('refuses a second point ahead of the opponent', () => {
    const points = [
      { pointNumber: 1, a: true, b: true },
      { pointNumber: 2, a: true, b: false },
    ];
    expect(placeAttempt(points, A)).toEqual({ kind: 'ahead' });
    // The opponent catches up instead
    expect(placeAttempt(points, B)).toEqual({ kind: 'fill', pointNumber: 2 });
  });

  it('counts the first empty slot by point number, not by array order', () => {
    const points = [
      { pointNumber: 2, a: false, b: true },
      { pointNumber: 1, a: true, b: true },
    ];
    expect(placeAttempt(points, A)).toEqual({ kind: 'fill', pointNumber: 2 });
  });
});

describe('nextScramble', () => {
  const set = (
    letter: string,
    scrambles: [num: number, isExtra: boolean, used: boolean][],
  ): ScrambleSetOption => ({
    id: `set-${letter}`,
    set: letter,
    scrambles: scrambles.map(([num, isExtra, used]) => ({
      id: `${letter}${isExtra ? 'E' : ''}${num}`,
      num,
      isExtra,
      used,
    })),
  });

  it("takes the set's normal scrambles in order first", () => {
    const own = set('C', [
      [2, false, false],
      [1, false, true],
      [1, true, false],
      [3, false, false],
    ]);
    expect(nextScramble(own, [])).toMatchObject({
      id: 'C2',
      set: 'C',
      num: 2,
      isExtra: false,
      fromSpare: false,
    });
  });

  it('takes the extras once the normal scrambles are used', () => {
    const own = set('C', [
      [1, false, true],
      [2, false, true],
      [2, true, false],
      [1, true, false],
    ]);
    expect(nextScramble(own, [])).toMatchObject({ id: 'CE1', isExtra: true });
  });

  it('takes the first spare set, in letter order, once the set is used up', () => {
    const own = set('C', [
      [1, false, true],
      [1, true, true],
    ]);
    const spares = [
      set('AA', [[1, false, false]]),
      set('K', [[1, false, false]]),
      set('J', [
        [1, false, true],
        [2, false, false],
      ]),
    ];
    expect(nextScramble(own, spares)).toMatchObject({
      id: 'J2',
      set: 'J',
      fromSpare: true,
    });
  });

  it('takes a spare when the set has no scramble set of its own', () => {
    expect(nextScramble(null, [set('K', [[1, false, false]])])).toMatchObject({
      id: 'K1',
      fromSpare: true,
    });
  });

  it('gives none when the set and every spare are used up', () => {
    const own = set('C', [[1, false, true]]);
    expect(nextScramble(own, [set('K', [[1, true, true]])])).toBeNull();
    expect(nextScramble(null, [])).toBeNull();
  });
});

describe('scoreMatch', () => {
  const point = (pointNumber: number, a: number | null, b: number | null) => ({
    pointNumber,
    a,
    b,
  });
  /** Points where A wins (1000 v 1100) and B wins (1100 v 1000) */
  const won = (side: H2hSide, pointNumber: number) =>
    side === A
      ? point(pointNumber, 1000, 1100)
      : point(pointNumber, 1100, 1000);
  const input = (sets: MatchInput['sets'], setsToWin = 1): MatchInput => ({
    setsToWin,
    seeds: { a: 1, b: 8 },
    sets,
    otherMatchResults: { a: [], b: [] },
  });

  it('decides each point with both attempts in, and leaves the open one', () => {
    const score = scoreMatch(
      input([
        {
          setNumber: 1,
          points: [won(B, 1), point(2, -1, -2), point(3, 900, null)],
        },
      ]),
    );
    expect([...score.sets[0].pointWinners]).toEqual([
      [1, B],
      [2, null],
    ]);
    expect(score.sets[0].outcome).toBeNull();
    expect(score.winner).toBeNull();
    expect(score.nextSetNumber).toBeNull();
  });

  it('gives the set to the first to 3 points and the match with it', () => {
    const score = scoreMatch(
      input([
        { setNumber: 1, points: [won(A, 1), won(B, 2), won(A, 3), won(A, 4)] },
      ]),
    );
    expect(score.sets[0].outcome).toEqual({
      winner: A,
      decidedBy: H2hSetDecision.POINTS,
    });
    expect(score.winner).toBe(A);
    expect(score.nextSetNumber).toBeNull();
  });

  it('asks for the next set when a set ends and the match goes on', () => {
    const score = scoreMatch(
      input([{ setNumber: 1, points: [won(B, 1), won(B, 2), won(B, 3)] }], 2),
    );
    expect(score.winner).toBeNull();
    expect(score.nextSetNumber).toBe(2);
  });

  it('feeds the tie-break with the match and the other matches', () => {
    // Seven points, no one on 3: 2-2 with 3 no-winner points, equal best
    // single in the set and the match, B better in the round
    const sets = [
      {
        setNumber: 1,
        points: [
          won(A, 1),
          won(B, 2),
          won(A, 3),
          won(B, 4),
          point(5, -1, -1),
          point(6, 1200, 1200),
          point(7, -2, -1),
        ],
      },
    ];
    const score = scoreMatch({
      ...input(sets),
      otherMatchResults: { a: [990], b: [950] },
    });
    expect(score.sets[0].outcome).toEqual({
      winner: B,
      decidedBy: H2hSetDecision.BEST_IN_ROUND,
    });
  });

  it('refuses a point recorded after the set was already over', () => {
    expect(() =>
      scoreMatch(
        input([
          {
            setNumber: 1,
            points: [won(A, 1), won(A, 2), won(A, 3), point(4, 1000, null)],
          },
        ]),
      ),
    ).toThrow(
      new MatchConflict(
        'Set 1 would be over after point 3, but point 4 has a result too. Check the times.',
      ),
    );
  });

  it('refuses a set started while the one before would still be going on', () => {
    expect(() =>
      scoreMatch(
        input(
          [
            { setNumber: 1, points: [won(A, 1), won(A, 2), won(B, 3)] },
            { setNumber: 2, points: [won(B, 1)] },
          ],
          2,
        ),
      ),
    ).toThrow(MatchConflict);
  });

  it('refuses a set played after the match would have ended', () => {
    expect(() =>
      scoreMatch(
        input([
          { setNumber: 1, points: [won(A, 1), won(A, 2), won(A, 3)] },
          { setNumber: 2, points: [won(B, 1)] },
        ]),
      ),
    ).toThrow(MatchConflict);
  });
});
