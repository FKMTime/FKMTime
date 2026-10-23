import { Attempt, AttemptStatus, AttemptType } from '@prisma/client';
import { Competition as Wcif } from 'wcif-helpers';

import {
  calculateGroupProgress,
  getExpectedAttempts,
  getGroupCompetitorIds,
} from './groupProgress';

let nextId = 0;
const attempt = (overrides: Partial<Attempt> = {}): Attempt =>
  ({
    id: `a${nextId++}`,
    attemptNumber: 1,
    replacedBy: null,
    type: AttemptType.STANDARD_ATTEMPT,
    status: AttemptStatus.STANDARD,
    penalty: 0,
    value: 1000,
    ...overrides,
  }) as Attempt;

const standard = (count: number, value = 1000) =>
  Array.from({ length: count }, (_, i) =>
    attempt({ attemptNumber: i + 1, value }),
  );

const wcif = {
  events: [
    { id: '333', rounds: [{ id: '333-r1', format: 'a', cutoff: null }] },
    {
      id: '666',
      rounds: [
        {
          id: '666-r1',
          format: 'm',
          cutoff: { numberOfAttempts: 1, attemptResult: 18000 },
        },
      ],
    },
  ],
  schedule: {
    venues: [
      {
        rooms: [
          {
            activities: [
              {
                id: 1,
                activityCode: '333-r1',
                childActivities: [
                  { id: 11, activityCode: '333-r1-g1', childActivities: [] },
                  { id: 12, activityCode: '333-r1-g2', childActivities: [] },
                ],
              },
              {
                id: 2,
                activityCode: '666-r1',
                childActivities: [
                  { id: 21, activityCode: '666-r1-g1', childActivities: [] },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  persons: [
    {
      registrantId: 1,
      assignments: [{ activityId: 11, assignmentCode: 'competitor' }],
    },
    {
      registrantId: 2,
      assignments: [{ activityId: 11, assignmentCode: 'competitor' }],
    },
    {
      registrantId: 3,
      assignments: [{ activityId: 11, assignmentCode: 'staff-judge' }],
    },
    {
      registrantId: 4,
      assignments: [{ activityId: 12, assignmentCode: 'competitor' }],
    },
    {
      registrantId: 5,
      assignments: [{ activityId: 21, assignmentCode: 'competitor' }],
    },
    {
      registrantId: 6,
      assignments: [{ activityId: 21, assignmentCode: 'competitor' }],
    },
  ],
} as unknown as Wcif;

describe('getGroupCompetitorIds', () => {
  it('returns competitors of the group, not its staff or other groups', () => {
    expect(getGroupCompetitorIds(wcif, '333-r1-g1')).toEqual([1, 2]);
  });
});

describe('getExpectedAttempts', () => {
  const cutoff = { numberOfAttempts: 2, attemptResult: 1000 };

  it('expects the full format without a cutoff', () => {
    expect(getExpectedAttempts([], 5)).toBe(5);
  });

  it('expects the full format until the cutoff attempts are done', () => {
    expect(getExpectedAttempts(standard(1, 2000), 5, cutoff)).toBe(5);
  });

  it('stops at the cutoff when it was not made', () => {
    expect(getExpectedAttempts(standard(2, 2000), 5, cutoff)).toBe(2);
  });

  it('expects the full format when the cutoff was made', () => {
    const counting = [
      attempt({ attemptNumber: 1, value: 2000 }),
      attempt({ attemptNumber: 2, value: 900 }),
    ];
    expect(getExpectedAttempts(counting, 5, cutoff)).toBe(5);
  });

  it('counts +2 and ignores DNFs when checking the cutoff', () => {
    expect(
      getExpectedAttempts(
        [
          attempt({ attemptNumber: 1, value: 950, penalty: 2 }),
          attempt({ attemptNumber: 2, value: 500, penalty: -1 }),
        ],
        5,
        cutoff,
      ),
    ).toBe(2);
  });

  it('accepts the wcif-helpers resultValue field name', () => {
    expect(
      getExpectedAttempts(standard(2, 2000), 5, {
        numberOfAttempts: 2,
        resultValue: 1000,
      }),
    ).toBe(2);
  });
});

describe('calculateGroupProgress', () => {
  it('counts entered and expected attempts for the group', () => {
    const progress = calculateGroupProgress(
      wcif,
      '333-r1-g1',
      new Map([
        [1, standard(5)],
        [2, standard(3)],
        // Not in this group
        [4, standard(5)],
      ]),
    );
    expect(progress).toEqual({
      groupId: '333-r1-g1',
      roundId: '333-r1',
      competitors: 2,
      entered: 8,
      expected: 10,
    });
  });

  it('does not count unresolved or scrambled attempts', () => {
    const progress = calculateGroupProgress(
      wcif,
      '333-r1-g1',
      new Map([
        [
          1,
          [
            attempt({ attemptNumber: 1 }),
            attempt({ attemptNumber: 2, status: AttemptStatus.UNRESOLVED }),
            attempt({ attemptNumber: 3, status: AttemptStatus.SCRAMBLED }),
          ],
        ],
      ]),
    );
    expect(progress.entered).toBe(1);
  });

  it('counts an extra once it replaces the original attempt', () => {
    const withPendingExtra = [
      attempt({
        attemptNumber: 1,
        status: AttemptStatus.EXTRA_GIVEN,
        replacedBy: 1,
      }),
    ];
    const withExtraDone = [
      ...withPendingExtra,
      attempt({ attemptNumber: 1, type: AttemptType.EXTRA_ATTEMPT }),
    ];
    expect(
      calculateGroupProgress(
        wcif,
        '333-r1-g1',
        new Map([[1, withPendingExtra]]),
      ).entered,
    ).toBe(0);
    expect(
      calculateGroupProgress(wcif, '333-r1-g1', new Map([[1, withExtraDone]]))
        .entered,
    ).toBe(1);
  });

  it('shrinks the expected total for competitors who missed the cutoff', () => {
    const progress = calculateGroupProgress(
      wcif,
      '666-r1-g1',
      new Map([
        [5, standard(1, 20000)],
        [6, standard(1, 15000)],
      ]),
    );
    // 5 missed the 1-attempt cutoff (1 expected), 6 made it (3 expected)
    expect(progress).toMatchObject({ entered: 2, expected: 4 });
  });
});
