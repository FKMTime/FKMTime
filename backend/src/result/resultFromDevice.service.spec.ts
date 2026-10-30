import { Attempt, AttemptStatus, AttemptType } from '@prisma/client';
import { DNF_VALUE } from 'src/constants';
import { DbService } from 'src/db/db.service';

import { ResultService } from './result.service';
import { ResultFromDeviceService } from './resultFromDevice.service';

describe('ResultFromDeviceService cutoff check', () => {
  // WCIF v2 cutoff shape: { numberOfAttempts, resultValue }
  const round = {
    id: 'clock-r1',
    timeLimit: { centiseconds: 6000, cumulativeRoundIds: [] },
    cutoff: { numberOfAttempts: 2, resultValue: 1200 },
  };
  const attempt = (value: number, penalty = 0) =>
    ({ value, penalty }) as Attempt;

  let resultService: { getSubmittedAttempts: jest.Mock };
  let service: ResultFromDeviceService;

  const validate = (submitted: Attempt[]) => {
    resultService.getSubmittedAttempts.mockResolvedValue(submitted);
    return service['getValidatedData']('person-1', round, { value: 1500 });
  };

  beforeEach(() => {
    resultService = { getSubmittedAttempts: jest.fn() };
    service = new ResultFromDeviceService(
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      resultService as unknown as ResultService,
      null,
    );
  });

  it('allows further attempts when the cutoff was made', async () => {
    const data = await validate([attempt(1500), attempt(1100)]);

    expect(data.cutoffPassed).toBe(true);
    expect(data.attemptNumber).toBe(3);
  });

  it('rejects further attempts when the cutoff was missed', async () => {
    const data = await validate([attempt(1500), attempt(1000, DNF_VALUE)]);

    expect(data.cutoffPassed).toBe(false);
    expect(data.penalty).toBe(0);
  });

  it('allows attempts before the cutoff attempts are done', async () => {
    const data = await validate([attempt(1500)]);

    expect(data.cutoffPassed).toBe(true);
    expect(data.attemptNumber).toBe(2);
  });
});

describe('ResultFromDeviceService with a resolved attempt', () => {
  const resolved = (id: string, attemptNumber: number, value: number) => ({
    id,
    attemptNumber,
    value,
    penalty: 0,
    replacedBy: null,
    type: AttemptType.STANDARD_ATTEMPT,
    status: AttemptStatus.RESOLVED,
  });
  const round = {
    id: '333bf-r1',
    timeLimit: { centiseconds: 0, cumulativeRoundIds: [] },
    cutoff: null,
  };

  let service: ResultFromDeviceService;

  beforeEach(() => {
    const findMany = jest
      .fn()
      .mockResolvedValue([
        resolved('s1', 1, 4000),
        resolved('s2', 2, 4500),
        { ...resolved('s3', 3, 9000), status: AttemptStatus.UNRESOLVED },
      ]);
    service = new ResultFromDeviceService(
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      new ResultService(
        { attempt: { findMany } } as unknown as DbService,
        null,
        null,
        null,
        null,
        null,
        null,
      ),
      null,
    );
  });

  it('counts it towards the cumulative limit', async () => {
    const data = await service['getValidatedData'](
      'person-1',
      {
        ...round,
        timeLimit: { centiseconds: 10000, cumulativeRoundIds: ['333bf-r1'] },
      },
      { value: 2000 },
    );

    expect(data.limitPassed).toBe(false);
    expect(data.penalty).toBe(-1);
  });

  it('checks it against the cutoff', async () => {
    const data = await service['getValidatedData'](
      'person-1',
      { ...round, cutoff: { numberOfAttempts: 2, resultValue: 3000 } },
      { value: 2000 },
    );

    expect(data.cutoffPassed).toBe(false);
  });

  it('does not count the unresolved attempt towards the cutoff', async () => {
    const data = await service['getValidatedData'](
      'person-1',
      { ...round, cutoff: { numberOfAttempts: 3, resultValue: 3000 } },
      { value: 2000 },
    );

    expect(data.cutoffPassed).toBe(true);
  });
});
