import {
  H2hMatchStatus,
  H2hSetDecision,
  H2hSide,
} from '../generated/prisma/client';
import {
  amendedAfter,
  FedMatch,
  MatchConflict,
  matchesFedBy,
  MatchInput,
  nextScramble,
  placeAttempt,
  scoreMatch,
  ScrambleSetOption,
  walkoverWinner,
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

  it("takes the set's next extra first for a point raced again after an extra", () => {
    const own = set('C', [
      [1, false, true],
      [2, false, false],
      [1, true, true],
      [2, true, false],
    ]);
    expect(nextScramble(own, [], { extra: true })).toMatchObject({
      id: 'CE2',
      isExtra: true,
    });
    const noExtraLeft = set('C', [
      [1, false, true],
      [2, false, false],
      [1, true, true],
    ]);
    expect(nextScramble(noExtraLeft, [], { extra: true })).toMatchObject({
      id: 'C2',
      isExtra: false,
    });
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

  describe('ignoring what was raced after the end (reopening)', () => {
    it('leaves points after the set was over without a winner', () => {
      const score = scoreMatch({
        ...input([
          {
            setNumber: 1,
            points: [won(A, 1), won(A, 2), won(A, 3), won(B, 4)],
          },
        ]),
        ignoreSurplus: true,
      });
      expect(score.winner).toBe(A);
      expect([...score.sets[0].pointWinners.keys()]).toEqual([1, 2, 3]);
      expect([...score.sets[0].afterEnd]).toEqual([4]);
    });

    it('leaves sets after the match was over without winners', () => {
      const score = scoreMatch({
        ...input([
          { setNumber: 1, points: [won(A, 1), won(A, 2), won(A, 3)] },
          { setNumber: 2, points: [won(B, 1), won(B, 2), won(B, 3)] },
        ]),
        ignoreSurplus: true,
      });
      expect(score.winner).toBe(A);
      expect(score.nextSetNumber).toBeNull();
      expect(score.sets[1]).toMatchObject({ outcome: null });
      expect(score.sets[1].pointWinners.size).toBe(0);
      expect([...score.sets[1].afterEnd]).toEqual([1, 2, 3]);
      expect(score.sets[0].afterEnd.size).toBe(0);
    });

    it('still refuses a set started while the one before would be going on', () => {
      expect(() =>
        scoreMatch({
          ...input(
            [
              { setNumber: 1, points: [won(A, 1), won(A, 2), won(B, 3)] },
              { setNumber: 2, points: [won(B, 1)] },
            ],
            2,
          ),
          ignoreSurplus: true,
        }),
      ).toThrow(MatchConflict);
    });
  });
});

describe('walkoverWinner', () => {
  const at = (minute: number) => new Date(2026, 0, 1, 10, minute);

  it('has no winner while nobody has withdrawn', () => {
    expect(
      walkoverWinner(
        { seed: 1, withdrawnAt: null },
        { seed: 2, withdrawnAt: null },
      ),
    ).toBeNull();
  });

  it('gives the match to the competitor still in', () => {
    expect(
      walkoverWinner(
        { seed: 1, withdrawnAt: at(5) },
        { seed: 2, withdrawnAt: null },
      ),
    ).toBe(B);
    expect(
      walkoverWinner(
        { seed: 1, withdrawnAt: null },
        { seed: 2, withdrawnAt: at(5) },
      ),
    ).toBe(A);
  });

  it('gives it to the one who left later when both have, then to the higher seed', () => {
    expect(
      walkoverWinner(
        { seed: 1, withdrawnAt: at(5) },
        { seed: 2, withdrawnAt: at(9) },
      ),
    ).toBe(B);
    expect(
      walkoverWinner(
        { seed: 3, withdrawnAt: at(5) },
        { seed: 2, withdrawnAt: at(5) },
      ),
    ).toBe(B);
  });
});

describe('matchesFedBy', () => {
  const match = (
    id: string,
    sources: [string | null, string | null],
    status: H2hMatchStatus = H2hMatchStatus.WAITING,
    startedAt: Date | null = null,
  ): FedMatch => ({
    id,
    status,
    startedAt,
    sourceAMatchId: sources[0],
    sourceBMatchId: sources[1],
  });
  const { WAITING, READY, IN_PROGRESS, FINISHED } = H2hMatchStatus;

  it('takes back the matches a semifinal feeds while none has started', () => {
    const matches = [
      match('sf1', [null, null], FINISHED, new Date()),
      match('sf2', [null, null], IN_PROGRESS, new Date()),
      match('third', ['sf1', 'sf2'], WAITING),
      match('final', ['sf1', 'sf2'], WAITING),
    ];
    const { reset, started } = matchesFedBy(matches, 'sf1');
    expect(started).toBeNull();
    expect(reset.map((m) => m.id)).toEqual(['third', 'final']);
  });

  it('goes on through walkovers that finished without starting', () => {
    const matches = [
      match('qf1', [null, null], FINISHED, new Date()),
      match('sf1', ['qf1', null], FINISHED),
      match('final', ['sf1', null], READY),
    ];
    expect(matchesFedBy(matches, 'qf1').reset.map((m) => m.id)).toEqual([
      'sf1',
      'final',
    ]);
  });

  it('names a match it feeds that has started', () => {
    const matches = [
      match('qf1', [null, null], FINISHED, new Date()),
      match('sf1', ['qf1', null], FINISHED),
      match('final', ['sf1', null], IN_PROGRESS, new Date()),
    ];
    expect(matchesFedBy(matches, 'qf1').started?.id).toBe('final');
  });
});

describe('amendedAfter', () => {
  const finishedAt = new Date(2026, 0, 1, 12, 0);
  const log = (minute: number, value: number, penalty: number | null = 0) => ({
    editedAt: new Date(2026, 0, 1, 11 + Math.floor(minute / 60), minute % 60),
    value,
    penalty,
  });

  it('is false for a time as it was when the match finished', () => {
    expect(
      amendedAfter(finishedAt, [log(10, 1000)], { value: 1000, penalty: 0 }),
    ).toBe(false);
  });

  it('is true for a time changed after the match', () => {
    expect(
      amendedAfter(finishedAt, [log(10, 1000), log(70, 1200)], {
        value: 1200,
        penalty: 0,
      }),
    ).toBe(true);
  });

  it('counts a penalty change, and not an edit made during the match', () => {
    expect(
      amendedAfter(finishedAt, [log(10, 1000), log(30, 1100)], {
        value: 1100,
        penalty: 0,
      }),
    ).toBe(false);
    expect(
      amendedAfter(finishedAt, [log(10, 1000), log(70, 1000, -1)], {
        value: 1000,
        penalty: -1,
      }),
    ).toBe(true);
  });

  it('is false for a time changed back to what it was', () => {
    expect(
      amendedAfter(finishedAt, [log(10, 1000), log(70, 1200), log(80, 1000)], {
        value: 1000,
        penalty: 0,
      }),
    ).toBe(false);
  });
});
