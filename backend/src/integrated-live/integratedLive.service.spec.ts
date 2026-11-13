import { AttemptStatus, AttemptType, LiveSyncStatus } from '@prisma/client';

import { IntegratedLiveService } from './integratedLive.service';
import { liveAttemptsHash } from './liveAttempts';

const WCA = 'https://wca.example';
const BASE = `${WCA}/api/v1/competitions/ExampleOpen2026/live`;

type Sync = {
  resultId: string;
  status: LiveSyncStatus;
  sentHash: string | null;
  sentAt: Date | null;
  checks: number;
  error: string | null;
  updatedAt: Date;
};

const attempt = (attemptNumber: number, value: number) => ({
  id: `att-${attemptNumber}-${value}`,
  attemptNumber,
  value,
  penalty: 0,
  type: AttemptType.STANDARD_ATTEMPT,
  status: AttemptStatus.STANDARD,
  replacedBy: null,
});

/** Just enough of Prisma for the worker's queries, over in-memory rows */
const createStore = () => {
  const results = new Map<string, Record<string, unknown>>();
  const syncs = new Map<string, Sync>();
  const clears: { id: string; roundId: string; wcaRegistrationId: number }[] =
    [];
  const competition = {
    id: 'competition-1',
    wcaId: 'ExampleOpen2026',
    wcaScoretakingSoftware: 'internal',
    scoretakingToken: null,
    wcif: {
      events: [
        {
          id: '333',
          rounds: [
            {
              id: '333-r1',
              format: 'a',
              timeLimit: { centiseconds: 60000, cumulativeRoundIds: [] },
              cutoff: null,
            },
          ],
        },
      ],
    },
  };
  const withResult = (sync: Sync) => ({
    ...sync,
    result: results.get(sync.resultId),
  });
  const matches = (sync: Sync, where: Record<string, any> = {}) => {
    if (where.status?.in && !where.status.in.includes(sync.status))
      return false;
    if (typeof where.status === 'string' && where.status !== sync.status) {
      return false;
    }
    if (where.resultId?.in && !where.resultId.in.includes(sync.resultId)) {
      return false;
    }
    if (where.updatedAt?.lte && sync.updatedAt > where.updatedAt.lte) {
      return false;
    }
    if (
      where.sentAt?.lte &&
      !(sync.sentAt && sync.sentAt <= where.sentAt.lte)
    ) {
      return false;
    }
    if (
      where.result?.roundId &&
      results.get(sync.resultId)?.roundId !== where.result.roundId
    ) {
      return false;
    }
    return true;
  };
  const write = (resultId: string, data: Partial<Sync>) => {
    const sync = syncs.get(resultId);
    Object.assign(sync, data, { updatedAt: new Date() });
    return sync;
  };
  const prisma = {
    competition: { findFirst: jest.fn(async () => competition) },
    result: {
      findMany: jest.fn(async ({ where }) =>
        [...results.values()].filter((r) => r.roundId === where.roundId),
      ),
    },
    liveSync: {
      findMany: jest.fn(async ({ where }) =>
        [...syncs.values()].filter((s) => matches(s, where)).map(withResult),
      ),
      update: jest.fn(async ({ where, data }) => write(where.resultId, data)),
      updateMany: jest.fn(async ({ where, data }) => {
        [...syncs.values()]
          .filter((s) => matches(s, where))
          .forEach((s) => write(s.resultId, data));
      }),
      upsert: jest.fn(async ({ where, create, update }) => {
        if (syncs.has(where.resultId)) return write(where.resultId, update);
        const sync = {
          sentHash: null,
          sentAt: null,
          checks: 0,
          error: null,
          updatedAt: new Date(),
          ...create,
        };
        syncs.set(where.resultId, sync);
        return sync;
      }),
    },
    liveClear: {
      findMany: jest.fn(async () => [...clears]),
      delete: jest.fn(async ({ where }) => {
        clears.splice(
          clears.findIndex((c) => c.id === where.id),
          1,
        );
      }),
      upsert: jest.fn(async ({ create }) => {
        clears.push({ id: `clear-${clears.length}`, ...create });
      }),
    },
    $transaction: jest.fn(async (operations) => Promise.all(operations)),
  };
  const addResult = (
    id: string,
    wcaRegistrationId: number | null,
    attempts: ReturnType<typeof attempt>[],
  ) => {
    results.set(id, {
      id,
      roundId: '333-r1',
      removedAt: null,
      attempts,
      person: { wcaRegistrationId },
    });
  };
  return { prisma, syncs, clears, competition, addResult };
};

describe('IntegratedLiveService', () => {
  const origin = process.env.WCA_ORIGIN;
  let store: ReturnType<typeof createStore>;
  let connection: { getAccessToken: jest.Mock; authorizedFetch: jest.Mock };
  let service: IntegratedLiveService;
  /** What the fake WCA holds per registration id, read back by GET round */
  let held: Map<number, { value: number; attempt_number: number }[]>;
  let respond: (url: string, init: RequestInit) => Partial<Response> | null;

  const json = (status: number, body: unknown = {}) =>
    ({ status, ok: status < 300, json: async () => body }) as Response;

  const calls = () =>
    connection.authorizedFetch.mock.calls.map(
      ([url, init]) => `${init?.method ?? 'GET'} ${url.replace(BASE, '')}`,
    );

  beforeEach(() => {
    process.env.WCA_ORIGIN = WCA;
    store = createStore();
    held = new Map([
      [101, []],
      [102, []],
    ]);
    respond = () => null;
    connection = {
      getAccessToken: jest.fn().mockResolvedValue('token'),
      authorizedFetch: jest.fn(async (url: string, init: RequestInit = {}) => {
        const custom = respond(url, init);
        if (custom) return custom;
        if ((init.method ?? 'GET') === 'GET') {
          return json(200, {
            results: [...held].map(([registration_id, attempts]) => ({
              registration_id,
              attempts,
            })),
          });
        }
        if (url.endsWith('/batch')) {
          for (const entry of JSON.parse(init.body as string).results) {
            held.set(entry.registration_id, entry.attempts);
          }
          return json(202, { status: 'ok' });
        }
        if (url.endsWith('/clear')) return json(200, { status: 'ok' });
        return json(404);
      }),
    };
    service = new IntegratedLiveService(
      store.prisma as never,
      connection as never,
    );
  });

  afterEach(() => {
    process.env.WCA_ORIGIN = origin;
  });

  it('sends dirty results of a round in one batch, with registration ids', async () => {
    store.addResult('r1', 101, [attempt(1, 1234), attempt(2, 1500)]);
    store.addResult('r2', 102, [attempt(1, 2000)]);
    await service.markDirty(['r1', 'r2']);

    await service.run();

    expect(calls()).toEqual([
      'GET /rounds/333-r1',
      'POST /rounds/333-r1/batch',
    ]);
    const body = JSON.parse(
      connection.authorizedFetch.mock.calls[1][1].body as string,
    );
    expect(body.results).toEqual([
      {
        registration_id: 101,
        attempts: [
          { attempt_number: 1, value: 1234 },
          { attempt_number: 2, value: 1500 },
        ],
      },
      { registration_id: 102, attempts: [{ attempt_number: 1, value: 2000 }] },
    ]);
    expect(store.syncs.get('r1')).toMatchObject({
      status: LiveSyncStatus.SENT,
      sentHash: liveAttemptsHash(body.results[0].attempts),
    });
  });

  it('waits, without calling the WCA, when there is no working connection', async () => {
    connection.getAccessToken.mockResolvedValue(null);
    store.addResult('r1', 101, [attempt(1, 1234)]);
    await service.markDirty(['r1']);

    await service.run();

    expect(connection.authorizedFetch).not.toHaveBeenCalled();
    expect(store.syncs.get('r1').status).toBe(LiveSyncStatus.DIRTY);
  });

  it('does nothing when results go somewhere else', async () => {
    store.competition.wcaScoretakingSoftware = 'wca_live';
    store.addResult('r1', 101, [attempt(1, 1234)]);
    await service.markDirty(['r1']);

    await service.run();

    expect(connection.authorizedFetch).not.toHaveBeenCalled();
  });

  it('marks what it cannot send, with the reason', async () => {
    store.addResult('no-registration', null, [attempt(1, 1234)]);
    store.addResult('not-in-round', 999, [attempt(1, 1234)]);
    store.addResult('over-limit', 101, [attempt(1, 61000)]);
    await service.markDirty(['no-registration', 'not-in-round', 'over-limit']);

    await service.run();

    expect(store.syncs.get('no-registration')).toMatchObject({
      status: LiveSyncStatus.NOT_SENDABLE,
      error: 'No WCA registration',
    });
    expect(store.syncs.get('not-in-round').status).toBe(
      LiveSyncStatus.NOT_IN_ROUND,
    );
    expect(store.syncs.get('over-limit')).toMatchObject({
      status: LiveSyncStatus.REJECTED,
      error: 'Attempt 1 is over the time limit',
    });
    expect(calls()).not.toContain('POST /rounds/333-r1/batch');
  });

  it('empties a result with no attempts left instead of writing it', async () => {
    store.addResult('r1', 101, []);
    await service.markDirty(['r1']);

    await service.run();

    expect(calls()).toContain('PUT /rounds/333-r1/101/clear');
    expect(store.syncs.get('r1').status).toBe(LiveSyncStatus.SENT);
  });

  it('clears the WCA copy of a deleted result', async () => {
    await service.queueClear('333-r1', 101);

    await service.run();

    expect(calls()).toEqual(['PUT /rounds/333-r1/101/clear']);
    expect(store.clears).toHaveLength(0);
  });

  it('marks the entry the WCA refused and sends the rest again later', async () => {
    store.addResult('r1', 101, [attempt(1, 1234)]);
    store.addResult('r2', 102, [attempt(1, 2000)]);
    await service.markDirty(['r1', 'r2']);
    respond = (url) =>
      url.endsWith('/batch')
        ? json(422, {
            status: 'user is not part of this round',
            registration_id: 102,
          })
        : null;

    await service.run();

    expect(store.syncs.get('r2')).toMatchObject({
      status: LiveSyncStatus.NOT_IN_ROUND,
      error: 'user is not part of this round',
    });
    expect(store.syncs.get('r1').status).toBe(LiveSyncStatus.DIRTY);
  });

  it('backs off after a 429 and sends nothing more for a while', async () => {
    store.addResult('r1', 101, [attempt(1, 1234)]);
    await service.markDirty(['r1']);
    respond = () => json(429);

    await service.run();
    connection.authorizedFetch.mockClear();
    await service.run();

    expect(connection.authorizedFetch).not.toHaveBeenCalled();
    expect(store.syncs.get('r1').status).toBe(LiveSyncStatus.DIRTY);
  });

  it('never makes more than 30 requests a minute', async () => {
    for (let i = 0; i < 40; i += 1) await service.queueClear('333-r1', i);

    await service.run();
    await service.run();

    expect(connection.authorizedFetch).toHaveBeenCalledTimes(30);
    expect(store.clears).toHaveLength(10);
  });

  describe('reading back', () => {
    const sentLongAgo = async (hash: string) => {
      store.addResult('r1', 101, [attempt(1, 1234)]);
      await service.markDirty(['r1']);
      Object.assign(store.syncs.get('r1'), {
        status: LiveSyncStatus.SENT,
        sentHash: hash,
        sentAt: new Date(Date.now() - 60_000),
      });
    };

    it('confirms a result the WCA holds as sent', async () => {
      const attempts = [{ attempt_number: 1, value: 1234 }];
      held.set(101, attempts);
      await sentLongAgo(liveAttemptsHash(attempts));

      await service.run();

      expect(store.syncs.get('r1').status).toBe(LiveSyncStatus.CONFIRMED);
    });

    it('sends again after three read-backs that do not match', async () => {
      await sentLongAgo(liveAttemptsHash([{ attempt_number: 1, value: 1234 }]));

      await service.run();
      await service.run();
      expect(store.syncs.get('r1')).toMatchObject({
        status: LiveSyncStatus.SENT,
        checks: 2,
      });
      await service.run();

      expect(store.syncs.get('r1').status).toBe(LiveSyncStatus.DIRTY);
    });
  });

  it('reports how a resubmitted round went', async () => {
    store.addResult('r1', 101, [attempt(1, 1234)]);
    store.addResult('r2', null, [attempt(1, 2000)]);

    const reply = await service.sendRoundNow('333-r1');

    expect(reply).toMatchObject({ accepted: 1, notAccepted: 1, waiting: 0 });
  });
});
