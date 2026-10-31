import { Attempt, AttemptStatus, AttemptType } from '@prisma/client';
import { AppGateway } from 'src/app.gateway';
import { DbService } from 'src/db/db.service';
import { ResultService } from 'src/result/result.service';
import { WcaService } from 'src/wca/wca.service';

import { CompetitionService } from './competition.service';

describe('CompetitionService group change with a redo outstanding', () => {
  const group = (activityCode: string, minute: number) => ({
    activityCode,
    startTime: new Date(Date.UTC(2026, 8, 30, 12, minute)).toISOString(),
  });
  const wcif = {
    events: [
      { id: '333', rounds: [{ id: '333-r1', format: 'a', cutoff: null }] },
    ],
    schedule: {
      venues: [
        {
          rooms: [
            {
              name: 'Main',
              activities: [
                {
                  activityCode: '333-r1',
                  childActivities: [
                    group('333-r1-g1', 0),
                    group('333-r1-g2', 30),
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  };
  const attempt = (id: string, attemptNumber: number, overrides = {}) =>
    ({
      id,
      attemptNumber,
      replacedBy: null,
      type: AttemptType.STANDARD_ATTEMPT,
      status: AttemptStatus.EXTRA_GIVEN,
      extraGrantId: 'fresh',
      penalty: 0,
      value: 1500,
      ...overrides,
    }) as Attempt;

  const canChange = async (
    currentGroupId: string,
    attempts: Attempt[],
    freshSetGrantIds = ['fresh'],
  ) => {
    const prisma = {
      room: {
        findFirst: jest
          .fn()
          .mockResolvedValue({
            id: 'room',
            name: 'Main',
            currentGroupIds: [currentGroupId],
          }),
      },
      competition: {
        findFirst: jest.fn().mockResolvedValue({ wcif }),
      },
      extraGrant: {
        findMany: jest
          .fn()
          .mockResolvedValue(freshSetGrantIds.map((id) => ({ id }))),
      },
    };
    const resultService = {
      getAllResultsByRound: jest.fn().mockResolvedValue([
        {
          attempts,
          eventId: '333',
          roundId: '333-r1',
          person: { registrantId: 1, wcaId: null },
        },
      ]),
    };
    const service = new CompetitionService(
      prisma as unknown as DbService,
      {
        server: { to: () => ({ emit: jest.fn() }) },
      } as unknown as AppGateway,
      resultService as unknown as ResultService,
      new WcaService(null),
      null,
    );
    const changeGroup = jest
      .spyOn(service, 'changeGroup')
      .mockResolvedValue(undefined);
    await service.checkIfGroupCanBeChanged('room');
    return changeGroup.mock.calls.length > 0;
  };

  const notStarted = [attempt('s1', 1), attempt('s2', 2)];
  const started = [
    attempt('s1', 1, { replacedBy: 1 }),
    attempt('s2', 2),
    attempt('e1', 1, {
      type: AttemptType.EXTRA_ATTEMPT,
      status: AttemptStatus.STANDARD,
      extraGrantId: null,
    }),
  ];

  it('moves on when a fresh-set redo is planned for the next group', async () => {
    expect(await canChange('333-r1-g1', notStarted)).toBe(true);
  });

  it('skips a partial grant the same way', async () => {
    const partial = [
      attempt('s1', 1, { status: AttemptStatus.STANDARD, extraGrantId: null }),
      attempt('s2', 2),
    ];
    expect(await canChange('333-r1-g1', partial)).toBe(true);
  });

  it('waits once the redo has started', async () => {
    expect(await canChange('333-r1-g1', started)).toBe(false);
  });

  it('waits for any redo in the last group', async () => {
    expect(await canChange('333-r1-g2', notStarted)).toBe(false);
  });
});
