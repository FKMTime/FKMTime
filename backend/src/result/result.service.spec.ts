import {
  AttemptStatus,
  AttemptType,
  StaffActivityStatus,
  StaffRole,
} from '@prisma/client';
import { AttemptEditLogService } from 'src/attempt-edit-log/attempt-edit-log.service';
import { DbService } from 'src/db/db.service';
import { WcaService } from 'src/wca/wca.service';

import { getFinalExtraAttempt } from './helpers';
import { ResultService } from './result.service';

describe('ResultService staffing checks', () => {
  const competed = {
    id: 'competed',
    resultId: 'alice-result',
    attemptNumber: 1,
    type: AttemptType.STANDARD_ATTEMPT,
    status: AttemptStatus.STANDARD,
    penalty: 0,
    solvedAt: new Date('2026-09-30T12:10:00Z'),
    result: { personId: 'alice', roundId: '333-r1', person: { name: 'Alice' } },
  };
  const staffed = {
    ...competed,
    id: 'staffed',
    resultId: 'bob-result',
    judgeId: 'alice',
    solvedAt: new Date('2026-09-30T12:05:00Z'),
    result: { personId: 'bob', roundId: '333-r1', person: { name: 'Bob' } },
  };
  let service: ResultService;
  let prisma: {
    attempt: { findMany: jest.Mock };
    result: { findUnique: jest.Mock };
    competition: { findFirst: jest.Mock };
    staffActivity: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      attempt: { findMany: jest.fn().mockResolvedValue([competed, staffed]) },
      result: {
        findUnique: jest.fn().mockResolvedValue({
          id: competed.resultId,
          roundId: '333-r1',
          attempts: [competed],
        }),
      },
      competition: { findFirst: jest.fn().mockResolvedValue({ wcif: {} }) },
      staffActivity: {
        findMany: jest.fn().mockResolvedValue(
          ['alice', 'bob'].map((personId) => ({
            personId,
            groupId: '333-r1-g1',
            role: StaffRole.COMPETITOR,
            status: StaffActivityStatus.PRESENT,
          })),
        ),
      },
    };
    service = new ResultService(
      prisma as unknown as DbService,
      null,
      null,
      null,
      null,
      null,
      null,
    );
  });

  it.each([false, true])(
    'includes staffing checks without duplicating existing checks (existing: %s)',
    async (alreadyFlagged) => {
      prisma.attempt.findMany
        .mockResolvedValueOnce(
          alreadyFlagged ? [{ ...competed, inspectionTime: 16000 }] : [],
        )
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      const checks = await service.getResultsChecks('333-r1');
      expect(checks).toHaveLength(1);
      expect(checks[0]).toMatchObject({
        id: 'competed',
        staffingWarnings: [
          expect.objectContaining({
            role: 'JUDGE',
            staffedAttemptId: 'staffed',
          }),
        ],
        ...(alreadyFlagged ? { inspectionTime: 16000 } : {}),
      });
      expect(prisma.attempt.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { result: { roundId: '333-r1' } },
        }),
      );
      expect(prisma.staffActivity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            role: StaffRole.COMPETITOR,
            status: StaffActivityStatus.PRESENT,
            groupId: { startsWith: '333-r1-g' },
          },
        }),
      );
    },
  );

  it('adds the same warning to the competitor result page', async () => {
    jest
      .spyOn(service, 'getRemainingAndUsedCumulativeLimit')
      .mockResolvedValue(null);
    const result = await service.getResultById('alice-result');
    expect(result.attempts[0].staffingWarnings).toEqual([
      expect.objectContaining({ role: 'JUDGE', staffedAttemptId: 'staffed' }),
    ]);
  });
});

describe('ResultService submitted attempts', () => {
  const standard = (id: string, attemptNumber: number, value: number) => ({
    id,
    attemptNumber,
    value,
    penalty: 0,
    replacedBy: null,
    type: AttemptType.STANDARD_ATTEMPT,
    status: AttemptStatus.STANDARD,
  });
  const extra = (id: string, attemptNumber: number, value: number) => ({
    ...standard(id, attemptNumber, value),
    type: AttemptType.EXTRA_ATTEMPT,
  });
  const extraGiven = (attempt: object, replacedBy: number) => ({
    ...attempt,
    replacedBy,
    status: AttemptStatus.EXTRA_GIVEN,
  });

  let findMany: jest.Mock;
  let service: ResultService;

  const submittedIds = async (attempts: object[]) => {
    findMany.mockResolvedValue(attempts);
    const submitted = await service.getSubmittedAttempts('333bf-r1', 'person');
    return submitted.map((attempt) => attempt.id);
  };

  beforeEach(() => {
    findMany = jest.fn();
    service = new ResultService(
      { attempt: { findMany } } as unknown as DbService,
      null,
      null,
      { getExtra: getFinalExtraAttempt } as unknown as WcaService,
      null,
      null,
      null,
    );
  });

  it('counts a resolved standard attempt', async () => {
    const ids = await submittedIds([
      standard('s1', 1, 1000),
      { ...standard('s2', 2, 2000), status: AttemptStatus.RESOLVED },
    ]);
    expect(ids).toEqual(['s1', 's2']);
  });

  it('counts a resolved extra that replaced an attempt', async () => {
    const ids = await submittedIds([
      extraGiven(standard('s1', 1, 1000), 1),
      { ...extra('e1', 1, 2000), status: AttemptStatus.RESOLVED },
    ]);
    expect(ids).toEqual(['e1']);
  });

  it('counts the resolved extra at the end of a chain', async () => {
    const ids = await submittedIds([
      extraGiven(standard('s1', 1, 1000), 1),
      extraGiven(extra('e1', 1, 2000), 2),
      { ...extra('e2', 2, 3000), status: AttemptStatus.RESOLVED },
    ]);
    expect(ids).toEqual(['e2']);
  });

  it('does not count unresolved attempts', async () => {
    const ids = await submittedIds([
      extraGiven(standard('s1', 1, 1000), 1),
      { ...extra('e1', 1, 2000), status: AttemptStatus.UNRESOLVED },
      { ...standard('s2', 2, 3000), status: AttemptStatus.UNRESOLVED },
    ]);
    expect(ids).toEqual([]);
  });

  it('does not count an extra still waiting to be done', async () => {
    const ids = await submittedIds([
      extraGiven(standard('s1', 1, 1000), 1),
      { ...extra('e1', 1, 2000), status: AttemptStatus.EXTRA_GIVEN },
    ]);
    expect(ids).toEqual([]);
  });

  it('adds resolved attempts to the time used across rounds', async () => {
    findMany
      .mockResolvedValueOnce([
        { ...standard('s1', 1, 1000), status: AttemptStatus.RESOLVED },
      ])
      .mockResolvedValueOnce([
        standard('s2', 1, 2000),
        { ...standard('s3', 2, 3000), status: AttemptStatus.UNRESOLVED },
      ]);
    await expect(
      service.getCumulativeSumForMultipleRounds('person', [
        '333bf-r1',
        '444bf-r1',
      ]),
    ).resolves.toBe(3000);
  });
});

describe('ResultService settling waiting extras', () => {
  const attempt = (overrides: object) => ({
    replacedBy: null,
    type: AttemptType.STANDARD_ATTEMPT,
    status: AttemptStatus.STANDARD,
    penalty: 0,
    value: 1500,
    ...overrides,
  });
  const extra = (id: string, attemptNumber: number) =>
    attempt({ id, attemptNumber, type: AttemptType.EXTRA_ATTEMPT });
  const replaced = (id: string, attemptNumber: number) =>
    attempt({
      id,
      attemptNumber,
      value: 1000,
      replacedBy: attemptNumber,
      status: AttemptStatus.EXTRA_GIVEN,
    });

  const settle = async (cutoff: object | null) => {
    const update = jest.fn().mockImplementation(async ({ data }) => data);
    const log = jest.fn();
    const prisma = {
      competition: {
        findFirst: jest.fn().mockResolvedValue({
          wcif: {
            events: [{ id: '333', rounds: [{ id: '333-r1', cutoff }] }],
          },
        }),
      },
      result: {
        findUnique: jest.fn().mockResolvedValue({
          roundId: '333-r1',
          attempts: [
            replaced('s1', 1),
            replaced('s2', 2),
            attempt({
              id: 's3',
              attemptNumber: 3,
              status: AttemptStatus.EXTRA_GIVEN,
            }),
            extra('e1', 1),
            extra('e2', 2),
          ],
        }),
      },
      attempt: { update },
    };
    const service = new ResultService(
      prisma as unknown as DbService,
      null,
      null,
      null,
      null,
      null,
      { log } as unknown as AttemptEditLogService,
    );
    return {
      voided: await service.settleWaitingExtras('result-1'),
      update,
      log,
    };
  };

  it('voids and logs what a missed cutoff made unnecessary', async () => {
    const { voided, update, log } = await settle({
      numberOfAttempts: 2,
      resultValue: 1200,
    });

    expect(voided).toBe(1);
    expect(update).toHaveBeenCalledWith({
      where: { id: 's3' },
      data: { status: AttemptStatus.VOIDED },
    });
    expect(log).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Date),
      null,
      'No longer needed: cutoff not met',
    );
  });

  it('leaves attempts alone in a round without a cutoff', async () => {
    const { voided, update } = await settle(null);

    expect(voided).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });
});
