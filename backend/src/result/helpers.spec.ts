import { Attempt, AttemptStatus, AttemptType } from '@prisma/client';
import { DNF_VALUE, DNS_VALUE } from 'src/constants';

import {
  attemptTimeWithPenalty,
  checkCutoff,
  getCountingAttempts,
  getFinalExtraAttempt,
  getRoundResultText,
} from './helpers';

const attempt = (overrides: Partial<Attempt>): Attempt =>
  ({
    replacedBy: null,
    type: AttemptType.STANDARD_ATTEMPT,
    status: AttemptStatus.STANDARD,
    penalty: 0,
    value: 1000,
    ...overrides,
  }) as Attempt;

describe('getFinalExtraAttempt', () => {
  it('follows a chain of extras to the last one', () => {
    const attempts = [
      attempt({
        id: 's1',
        attemptNumber: 1,
        replacedBy: 1,
        status: AttemptStatus.EXTRA_GIVEN,
      }),
      attempt({
        id: 'e1',
        attemptNumber: 1,
        type: AttemptType.EXTRA_ATTEMPT,
        replacedBy: 2,
        status: AttemptStatus.EXTRA_GIVEN,
      }),
      attempt({ id: 'e2', attemptNumber: 2, type: AttemptType.EXTRA_ATTEMPT }),
    ];
    expect(getFinalExtraAttempt('s1', attempts)?.id).toBe('e2');
  });
});

describe('getCountingAttempts', () => {
  it('keeps standard attempts in order and swaps in extras', () => {
    const attempts = [
      attempt({
        id: 's2',
        attemptNumber: 2,
        replacedBy: 1,
        status: AttemptStatus.EXTRA_GIVEN,
      }),
      attempt({ id: 's1', attemptNumber: 1 }),
      attempt({ id: 's3', attemptNumber: 3, status: AttemptStatus.RESOLVED }),
      attempt({ id: 'e1', attemptNumber: 1, type: AttemptType.EXTRA_ATTEMPT }),
      attempt({ id: 's4', attemptNumber: 4, status: AttemptStatus.UNRESOLVED }),
      attempt({ id: 's5', attemptNumber: 5, status: AttemptStatus.SCRAMBLED }),
    ];
    expect(getCountingAttempts(attempts).map((a) => a.id)).toEqual([
      's1',
      'e1',
      's3',
    ]);
  });
});

describe('attemptTimeWithPenalty', () => {
  it('adds +2 penalties', () => {
    expect(attemptTimeWithPenalty({ value: 1000, penalty: 2 })).toBe(1200);
  });

  it('counts the time a DNF took', () => {
    expect(attemptTimeWithPenalty({ value: 1500, penalty: DNF_VALUE })).toBe(
      1500,
    );
  });

  it('counts nothing for a DNS', () => {
    expect(attemptTimeWithPenalty({ value: 0, penalty: DNS_VALUE })).toBe(0);
  });
});

describe('checkCutoff', () => {
  const cutoff = 6000;

  it('is not made by DNS attempts', () => {
    const attempts = [
      attempt({ attemptNumber: 1, value: 0, penalty: DNS_VALUE }),
      attempt({ attemptNumber: 2, value: 0, penalty: DNS_VALUE }),
    ];
    expect(checkCutoff(attempts, cutoff, 2)).toBe(false);
  });

  it('is made by an attempt under the cutoff', () => {
    const attempts = [
      attempt({ attemptNumber: 1, value: 0, penalty: DNS_VALUE }),
      attempt({ attemptNumber: 2, value: 5000, penalty: 2 }),
    ];
    expect(checkCutoff(attempts, cutoff, 2)).toBe(true);
  });
});

describe('getRoundResultText', () => {
  const times = (...values: [number, number?][]) =>
    values.map(([value, penalty = 0]) => ({ value, penalty }));

  it('averages the middle three of five', () => {
    expect(
      getRoundResultText(
        times([1100], [1250], [1300], [900], [1500, DNF_VALUE]),
        'a',
      ),
    ).toBe('Ao5: 12.17');
  });

  it('counts +2 into the average', () => {
    expect(
      getRoundResultText(times([1000, 2], [1000], [1000], [800], [1500]), 'a'),
    ).toBe('Ao5: 10.67');
  });

  it('is a DNF average with two unsolved attempts', () => {
    expect(
      getRoundResultText(
        times([1000], [0, DNS_VALUE], [1000], [1000], [1500, DNF_VALUE]),
        'a',
      ),
    ).toBe('Ao5: DNF');
  });

  it('rounds averages over ten minutes to the second', () => {
    expect(
      getRoundResultText(
        times([60040], [60080], [60090], [50000], [70000]),
        'a',
      ),
    ).toBe('Ao5: 10:01.00');
  });

  it('is a DNF mean with any unsolved attempt', () => {
    expect(
      getRoundResultText(times([1000], [1100], [1200, DNF_VALUE]), 'm'),
    ).toBe('Mo3: DNF');
    expect(getRoundResultText(times([1000], [1100], [1220]), 'm')).toBe(
      'Mo3: 11.07',
    );
  });

  it('shows the best single for best-of formats', () => {
    expect(
      getRoundResultText(times([2500, DNF_VALUE], [2137], [2200]), '3'),
    ).toBe('Best: 21.37');
    expect(getRoundResultText(times([0, DNS_VALUE]), '1')).toBe('Best: DNF');
  });

  it('shows the best single when the cutoff stopped the average', () => {
    expect(getRoundResultText(times([1500], [1600]), 'a')).toBe('Best: 15.00');
  });
});
