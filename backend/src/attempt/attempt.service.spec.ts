import {
  Attempt,
  AttemptStatus,
  AttemptType,
  SendingResultsFrequency,
} from '@prisma/client';
import { AppGateway } from 'src/app.gateway';
import { AttemptEditLogService } from 'src/attempt-edit-log/attempt-edit-log.service';
import { AttendanceService } from 'src/attendance/attendance.service';
import { DbService } from 'src/db/db.service';
import { IncidentService } from 'src/incident/incident.service';
import { ResultService } from 'src/result/result.service';
import { SocketController } from 'src/socket/socket.controller';

import { AttemptService } from './attempt.service';

describe('AttemptService extras for all attempts', () => {
  const stored = (overrides: Partial<Attempt>) =>
    ({
      replacedBy: null,
      type: AttemptType.STANDARD_ATTEMPT,
      status: AttemptStatus.STANDARD,
      penalty: 0,
      value: 1500,
      ...overrides,
    }) as Attempt;

  let attempts: Attempt[];
  let grants: { id: string; restoredAt: Date | null; attempts: Attempt[] }[];
  let format: string;
  let sendingResultsFrequency: SendingResultsFrequency;
  let prisma: Record<string, any>;
  let resultService: {
    enterWholeScorecardToWcaLiveOrCubingContests: jest.Mock;
  };
  let appGateway: { handleAttemptUpdated: jest.Mock };
  let service: AttemptService;

  const give = (attemptIds: string[], extra = {}) =>
    service.giveExtras(
      {
        resultId: 'result-1',
        attemptIds,
        comment: 'Illegal cube',
        useFreshSet: false,
        removeFromLive: true,
        ...extra,
      },
      'user-1',
    );

  beforeEach(() => {
    attempts = [
      stored({ id: 's1', attemptNumber: 1 }),
      stored({
        id: 's2',
        attemptNumber: 2,
        status: AttemptStatus.RESOLVED,
      }),
    ];
    grants = [];
    format = 'a';
    sendingResultsFrequency = SendingResultsFrequency.AFTER_SOLVE;
    prisma = {
      competition: {
        findFirst: jest.fn().mockImplementation(async () => ({
          sendingResultsFrequency,
          wcif: { events: [{ id: '333', rounds: [{ id: '333-r1', format }] }] },
        })),
      },
      result: {
        findUnique: jest
          .fn()
          .mockImplementation(async ({ where }) =>
            where.id === 'result-1'
              ? { id: 'result-1', roundId: '333-r1', attempts }
              : null,
          ),
        update: jest.fn(),
      },
      attempt: {
        update: jest.fn().mockImplementation(async ({ where, data }) => {
          const attempt = attempts.find((a) => a.id === where.id);
          const { extraGrant, ...scalars } = data;
          delete scalars.updatedBy;
          Object.assign(attempt, scalars);
          attempt.extraGrantId = extraGrant?.connect?.id ?? null;
          return attempt;
        }),
      },
      extraGrant: {
        create: jest.fn().mockImplementation(async () => {
          const grant = {
            id: `grant-${grants.length + 1}`,
            resultId: 'result-1',
            restoredAt: null,
            attempts: [],
          };
          grants.push(grant);
          return grant;
        }),
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          const grant = grants.find((g) => g.id === where.id);
          return (
            grant && {
              ...grant,
              attempts: attempts.filter((a) => a.extraGrantId === grant.id),
            }
          );
        }),
        findFirst: jest.fn().mockImplementation(async () => {
          const grant = grants.filter((g) => !g.restoredAt).at(-1);
          return grant ? { ...grant, attempts: [] } : null;
        }),
        update: jest.fn().mockImplementation(async ({ where, data }) => {
          Object.assign(
            grants.find((g) => g.id === where.id),
            data,
          );
        }),
      },
    };
    prisma.$transaction = jest.fn().mockImplementation((work) => work(prisma));
    resultService = {
      enterWholeScorecardToWcaLiveOrCubingContests: jest.fn(),
    };
    appGateway = { handleAttemptUpdated: jest.fn() };
    service = new AttemptService(
      appGateway as unknown as AppGateway,
      prisma as unknown as DbService,
      null as AttendanceService,
      { log: jest.fn() } as unknown as AttemptEditLogService,
      resultService as unknown as ResultService,
      null as SocketController,
      null as IncidentService,
    );
  });

  it('leaves the chosen attempts waiting for extras', async () => {
    await expect(give(['s1', 's2'])).resolves.toEqual({ replaced: 2 });

    expect(attempts.map((a) => a.status)).toEqual([
      AttemptStatus.EXTRA_GIVEN,
      AttemptStatus.EXTRA_GIVEN,
    ]);
    expect(attempts.map((a) => a.statusBeforeGrant)).toEqual([
      AttemptStatus.STANDARD,
      AttemptStatus.RESOLVED,
    ]);
    expect(attempts.every((a) => a.comment === 'Illegal cube')).toBe(true);
  });

  it('only touches the chosen attempts', async () => {
    await give(['s2']);

    expect(attempts[0].status).toBe(AttemptStatus.STANDARD);
    expect(attempts[1].status).toBe(AttemptStatus.EXTRA_GIVEN);
  });

  it('clears the double-check', async () => {
    await give(['s1']);

    expect(prisma.result.update).toHaveBeenCalledWith({
      where: { id: 'result-1' },
      data: expect.objectContaining({ isDoubleChecked: false }),
    });
  });

  it('sends the scorecard when asked to remove the times', async () => {
    await give(['s1']);

    expect(
      resultService.enterWholeScorecardToWcaLiveOrCubingContests,
    ).toHaveBeenCalledWith('result-1');
  });

  it('sends nothing when not asked to', async () => {
    await give(['s1'], { removeFromLive: false });

    expect(
      resultService.enterWholeScorecardToWcaLiveOrCubingContests,
    ).not.toHaveBeenCalled();
  });

  it('sends nothing on a competition set to never send', async () => {
    sendingResultsFrequency = SendingResultsFrequency.NEVER;

    await give(['s1']);

    expect(
      resultService.enterWholeScorecardToWcaLiveOrCubingContests,
    ).not.toHaveBeenCalled();
  });

  it('survives a failed send', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    resultService.enterWholeScorecardToWcaLiveOrCubingContests.mockRejectedValue(
      new Error('offline'),
    );

    await expect(give(['s1'])).resolves.toEqual({ replaced: 1 });
  });

  it('rejects a result that does not exist', async () => {
    await expect(
      service.giveExtras(
        {
          resultId: 'missing',
          attemptIds: ['s1'],
          useFreshSet: false,
          removeFromLive: true,
        },
        'user-1',
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('rejects an attempt that does not count', async () => {
    attempts[1].status = AttemptStatus.SCRAMBLED;

    await expect(give(['s2'])).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a head-to-head round', async () => {
    format = 'h';

    await expect(give(['s1'])).rejects.toMatchObject({ status: 400 });
  });

  it('asks to resolve an open incident first', async () => {
    attempts[1].status = AttemptStatus.UNRESOLVED;

    await expect(give(['s1'])).rejects.toMatchObject({ status: 409 });
  });

  describe('restoring the original attempts', () => {
    it('puts every attempt back as it was', async () => {
      await give(['s1', 's2']);
      attempts[0].replacedBy = 1;

      await expect(
        service.restoreExtraGrant('grant-1', 'user-1'),
      ).resolves.toEqual({ restored: 2 });

      expect(attempts.map((a) => a.status)).toEqual([
        AttemptStatus.STANDARD,
        AttemptStatus.RESOLVED,
      ]);
      expect(attempts.map((a) => a.replacedBy)).toEqual([null, null]);
      expect(grants[0].restoredAt).toBeInstanceOf(Date);
    });

    it('brings back an attempt that was voided', async () => {
      await give(['s1']);
      attempts[0].status = AttemptStatus.VOIDED;

      await service.restoreExtraGrant('grant-1', 'user-1');

      expect(attempts[0].status).toBe(AttemptStatus.STANDARD);
    });

    it('clears the double-check and sends the scorecard', async () => {
      await give(['s1'], { removeFromLive: false });
      prisma.result.update.mockClear();

      await service.restoreExtraGrant('grant-1', 'user-1');

      expect(prisma.result.update).toHaveBeenCalled();
      expect(
        resultService.enterWholeScorecardToWcaLiveOrCubingContests,
      ).toHaveBeenCalledWith('result-1');
    });

    it('only restores the latest grant', async () => {
      await give(['s1']);
      await give(['s2']);

      await expect(
        service.restoreExtraGrant('grant-1', 'user-1'),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('rejects a grant that does not exist', async () => {
      await expect(
        service.restoreExtraGrant('missing', 'user-1'),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('asks to resolve an open incident first', async () => {
      await give(['s1']);
      attempts[1].status = AttemptStatus.UNRESOLVED;

      await expect(
        service.restoreExtraGrant('grant-1', 'user-1'),
      ).rejects.toMatchObject({ status: 409 });
    });
  });
});
