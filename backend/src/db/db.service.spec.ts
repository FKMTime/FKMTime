import {
  DbService,
  INCLUDING_REMOVED,
  runInTransaction,
  withoutRemovedResultAttempts,
  withoutRemovedResults,
} from './db.service';

describe('leaving out results removed under Regulation 9t', () => {
  it('adds the filter to a result query', () => {
    expect(withoutRemovedResults({ roundId: '333-r2' })).toEqual({
      roundId: '333-r2',
      removedAt: null,
    });
    expect(withoutRemovedResults(undefined)).toEqual({ removedAt: null });
  });

  it('lets a query opt back in', () => {
    const where = { personId: 'p1', ...INCLUDING_REMOVED };

    expect(withoutRemovedResults(where)).toBe(where);
  });

  it('keeps an attempt query filter on its result', () => {
    expect(
      withoutRemovedResultAttempts({ result: { roundId: '333-r2' } }),
    ).toEqual({ result: { roundId: '333-r2', removedAt: null } });
    expect(withoutRemovedResultAttempts({ status: 'UNRESOLVED' })).toEqual({
      status: 'UNRESOLVED',
      result: { removedAt: null },
    });
  });

  it("leaves a query about one result's or attempt's own rows alone", () => {
    const byResult = { resultId: 'r1' };
    const byId = { id: { in: ['a1'] } };

    expect(withoutRemovedResultAttempts(byResult)).toBe(byResult);
    expect(withoutRemovedResultAttempts(byId)).toBe(byId);
  });
});

describe('running work in one transaction', () => {
  const client = { name: 'transaction client' };
  // Runs the work like Prisma does, recording what happened when
  const prismaRecording = (events: string[]) =>
    ({
      $transaction: async (work: (db: unknown) => Promise<unknown>) => {
        events.push('begin');
        try {
          const result = await work(client);
          events.push('commit');
          return result;
        } catch (e) {
          events.push('rollback');
          throw e;
        }
      },
    }) as unknown as DbService;

  it('runs the effects after the commit', async () => {
    const events: string[] = [];

    const result = await runInTransaction(
      prismaRecording(events),
      async (tx) => {
        expect(tx.db).toBe(client);
        tx.afterCommit(() => events.push('effect 1'));
        tx.afterCommit(() => events.push('effect 2'));
        events.push('work');
        return 'entered';
      },
    );

    expect(result).toBe('entered');
    expect(events).toEqual(['begin', 'work', 'commit', 'effect 1', 'effect 2']);
  });

  it('runs no effect when the transaction rolls back', async () => {
    const events: string[] = [];

    await expect(
      runInTransaction(prismaRecording(events), async (tx) => {
        tx.afterCommit(() => events.push('effect'));
        throw new Error('write failed');
      }),
    ).rejects.toThrow('write failed');

    expect(events).toEqual(['begin', 'rollback']);
  });
});
