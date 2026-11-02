import { AttemptStatus, AttemptType } from '@prisma/client';

import { getRoundAttemptStats, StatsAttempt } from './roundAttemptStats';

const attempt = (overrides: Partial<StatsAttempt>): StatsAttempt => ({
  status: AttemptStatus.STANDARD,
  type: AttemptType.STANDARD_ATTEMPT,
  penalty: 0,
  sessionId: 'session',
  result: { roundId: '333-r1' },
  ...overrides,
});

describe('getRoundAttemptStats', () => {
  it('counts solves, manual entries, used extras and DNFs per round', () => {
    const stats = getRoundAttemptStats([
      attempt({}),
      attempt({ sessionId: null }),
      attempt({ sessionId: null, penalty: -2 }),
      attempt({ penalty: -1 }),
      attempt({ type: AttemptType.EXTRA_ATTEMPT }),
      attempt({
        type: AttemptType.EXTRA_ATTEMPT,
        status: AttemptStatus.EXTRA_GIVEN,
      }),
      attempt({ result: { roundId: 'pyram-r1' } }),
    ]);

    expect(stats).toEqual([
      { roundId: '333-r1', solves: 6, manual: 1, extras: 1, dnf: 1 },
      { roundId: 'pyram-r1', solves: 1, manual: 0, extras: 0, dnf: 0 },
    ]);
  });

  it('skips attempts that were only scrambled', () => {
    expect(
      getRoundAttemptStats([attempt({ status: AttemptStatus.SCRAMBLED })]),
    ).toEqual([]);
  });

  it('leaves out voided attempts', () => {
    expect(
      getRoundAttemptStats([
        attempt({}),
        attempt({ status: AttemptStatus.VOIDED }),
      ]),
    ).toEqual([{ roundId: '333-r1', solves: 1, manual: 0, extras: 0, dnf: 0 }]);
  });
});
