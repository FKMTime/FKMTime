import { Attempt } from '@prisma/client';
import { DNF_VALUE } from 'src/constants';

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
