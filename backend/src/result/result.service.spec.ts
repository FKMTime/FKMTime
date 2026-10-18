import {
  AttemptStatus,
  AttemptType,
  StaffActivityStatus,
  StaffRole,
} from '@prisma/client';
import { DbService } from 'src/db/db.service';

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
