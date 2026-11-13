import { Attempt, AttemptStatus, AttemptType } from '@prisma/client';

import {
  breaksRoundRules,
  liveAttemptsHash,
  toLiveAttempts,
} from './liveAttempts';

const attempt = (
  attemptNumber: number,
  value: number,
  penalty = 0,
  overrides: Partial<Attempt> = {},
) =>
  ({
    id: `a${attemptNumber}`,
    attemptNumber,
    value,
    penalty,
    type: AttemptType.STANDARD_ATTEMPT,
    status: AttemptStatus.STANDARD,
    replacedBy: null,
    ...overrides,
  }) as Attempt;

describe('toLiveAttempts', () => {
  it('encodes times, +2, DNF and DNS like WCA Live', () => {
    expect(
      toLiveAttempts([
        attempt(1, 1234),
        attempt(2, 1500, 2),
        attempt(3, 900, -1),
        attempt(4, 0, -2),
      ]),
    ).toEqual([
      { attempt_number: 1, value: 1234 },
      { attempt_number: 2, value: 1700 },
      { attempt_number: 3, value: -1 },
      { attempt_number: 4, value: -2 },
    ]);
  });

  it('leaves out attempts with nothing to send yet', () => {
    expect(toLiveAttempts([attempt(1, 1234), attempt(2, 0)])).toEqual([
      { attempt_number: 1, value: 1234 },
    ]);
  });
});

describe('breaksRoundRules', () => {
  const round = { maxAttempts: 5, cutoff: null, timeLimit: null };

  it('accepts attempts within the round rules', () => {
    expect(
      breaksRoundRules(
        [
          { attempt_number: 1, value: 1200 },
          { attempt_number: 2, value: -1 },
        ],
        round,
      ),
    ).toBeNull();
  });

  it('refuses more attempts than the format allows', () => {
    expect(
      breaksRoundRules([{ attempt_number: 4, value: 1200 }], {
        ...round,
        maxAttempts: 3,
      }),
    ).toMatch(/More attempts/);
  });

  it('refuses attempts after a missed cutoff', () => {
    const cutoff = { numberOfAttempts: 2, resultValue: 3000 };
    const missed = [
      { attempt_number: 1, value: 3500 },
      { attempt_number: 2, value: -1 },
      { attempt_number: 3, value: 2800 },
    ];

    expect(breaksRoundRules(missed, { ...round, cutoff })).toMatch(/cutoff/);
    expect(
      breaksRoundRules(
        [{ attempt_number: 1, value: 2900 }, ...missed.slice(1)],
        { ...round, cutoff },
      ),
    ).toBeNull();
  });

  it('refuses an attempt over a non-cumulative time limit', () => {
    const timeLimit = { centiseconds: 60000, cumulativeRoundIds: [] };

    expect(
      breaksRoundRules([{ attempt_number: 2, value: 60100 }], {
        ...round,
        timeLimit,
      }),
    ).toMatch(/Attempt 2 is over the time limit/);
  });

  it('leaves cumulative limits to the station', () => {
    const timeLimit = { centiseconds: 60000, cumulativeRoundIds: ['444bf-r1'] };

    expect(
      breaksRoundRules([{ attempt_number: 1, value: 70000 }], {
        ...round,
        timeLimit,
      }),
    ).toBeNull();
  });
});

describe('liveAttemptsHash', () => {
  it('ignores order but not values', () => {
    const a = { attempt_number: 1, value: 1000 };
    const b = { attempt_number: 2, value: 2000 };

    expect(liveAttemptsHash([a, b])).toBe(liveAttemptsHash([b, a]));
    expect(liveAttemptsHash([a, b])).not.toBe(
      liveAttemptsHash([a, { ...b, value: 2001 }]),
    );
  });
});
