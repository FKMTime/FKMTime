import { Attempt, AttemptStatus, AttemptType } from '@prisma/client';
import { DbService } from 'src/db/db.service';
import { WcaService } from 'src/wca/wca.service';

import { PersonForDeviceService } from './personForDevice.service';

describe('PersonForDeviceService finished rounds', () => {
  const roundId = '333-r1';
  const wcif = {
    events: [
      {
        id: '333',
        rounds: [
          {
            id: roundId,
            format: 'a',
            cutoff: {
              numberOfAttempts: 2,
              attemptResult: 1200,
              resultValue: 1200,
            },
          },
        ],
      },
    ],
  };
  const attempt = (overrides: Partial<Attempt>) =>
    ({
      replacedBy: null,
      type: AttemptType.STANDARD_ATTEMPT,
      status: AttemptStatus.STANDARD,
      penalty: 0,
      value: 1500,
      ...overrides,
    }) as Attempt;

  const finishedRounds = (attempts: Attempt[]) => {
    const prisma = {
      result: {
        findMany: jest.fn().mockResolvedValue([
          {
            roundId,
            attempts,
            eventId: '333',
            person: { registrantId: 1, wcaId: null },
          },
        ]),
      },
    };
    const service = new PersonForDeviceService(
      prisma as unknown as DbService,
      null,
      new WcaService(null),
      null,
    );
    return service['getFinishedRoundIds'](
      'person-1',
      {} as never,
      wcif as never,
    );
  };

  it('ignores a replaced time that met the cutoff', async () => {
    const finished = await finishedRounds([
      attempt({
        id: 's1',
        attemptNumber: 1,
        value: 1000,
        replacedBy: 1,
        status: AttemptStatus.EXTRA_GIVEN,
      }),
      attempt({
        id: 's2',
        attemptNumber: 2,
        value: 1000,
        replacedBy: 2,
        status: AttemptStatus.EXTRA_GIVEN,
      }),
      attempt({ id: 'e1', attemptNumber: 1, type: AttemptType.EXTRA_ATTEMPT }),
      attempt({ id: 'e2', attemptNumber: 2, type: AttemptType.EXTRA_ATTEMPT }),
    ]);

    expect(finished).toEqual([roundId]);
  });

  it('keeps the round open when a counting attempt met the cutoff', async () => {
    const finished = await finishedRounds([
      attempt({ id: 's1', attemptNumber: 1, value: 1000 }),
      attempt({ id: 's2', attemptNumber: 2 }),
    ]);

    expect(finished).toEqual([]);
  });
});
