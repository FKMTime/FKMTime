import { AttemptStatus, AttemptType, LiveSyncStatus } from '@prisma/client';

import { IntegratedLiveRoundsService } from './integratedLiveRounds.service';

const WCA = 'https://wca.example';

describe('IntegratedLiveRoundsService', () => {
  const origin = process.env.WCA_ORIGIN;
  let competition: Record<string, unknown>;
  let previousResults: unknown[];
  let rounds: { id: string; state: string }[];
  let responses: Record<string, { status: number; body: unknown }>;
  let connection: { authorizedFetch: jest.Mock };
  let sender: { markRoundDirty: jest.Mock; markDirty: jest.Mock };
  let appGateway: {
    handleRoundShouldBeOpened: jest.Mock;
    handleIntegratedLiveRoundsChanged: jest.Mock;
  };
  let service: IntegratedLiveRoundsService;

  const calls = () =>
    connection.authorizedFetch.mock.calls.map(
      ([url, init]) =>
        `${init?.method ?? 'GET'} ${url.replace(`${WCA}/api/v1/competitions/ExampleOpen2026/live`, '')}`,
    );

  beforeEach(() => {
    process.env.WCA_ORIGIN = WCA;
    competition = {
      wcaId: 'ExampleOpen2026',
      wcaScoretakingSoftware: 'internal',
      scoretakingToken: null,
      openRoundsAutomatically: false,
    };
    previousResults = [];
    rounds = [
      { id: '333-r1', state: 'ready' },
      { id: '333-r2', state: 'ready' },
    ];
    responses = {};
    connection = {
      authorizedFetch: jest.fn(async (url: string, init: RequestInit = {}) => {
        const key = `${init.method ?? 'GET'} ${url.split('/live')[1]}`;
        if (responses[key]) {
          const { status, body } = responses[key];
          return { status, ok: status < 300, json: async () => body };
        }
        if (key === 'GET /rounds') {
          return { status: 200, ok: true, json: async () => ({ rounds }) };
        }
        return { status: 200, ok: true, json: async () => ({ status: 'ok' }) };
      }),
    };
    sender = {
      markRoundDirty: jest.fn().mockResolvedValue(undefined),
      markDirty: jest.fn().mockResolvedValue(undefined),
    };
    appGateway = {
      handleRoundShouldBeOpened: jest.fn(),
      handleIntegratedLiveRoundsChanged: jest.fn(),
    };
    const prisma = {
      competition: { findFirst: jest.fn(async () => competition) },
      result: { findMany: jest.fn(async () => previousResults) },
    };
    service = new IntegratedLiveRoundsService(
      prisma as never,
      connection as never,
      sender as never,
      appGateway as never,
    );
  });

  afterEach(() => {
    process.env.WCA_ORIGIN = origin;
  });

  describe('onRoundStarted', () => {
    it('opens a first round straight away, then sends what waited', async () => {
      await service.onRoundStarted('333-r1');

      expect(calls()).toContain('PUT /rounds/333-r1/open');
      expect(sender.markRoundDirty).toHaveBeenCalledWith('333-r1');
      expect(appGateway.handleIntegratedLiveRoundsChanged).toHaveBeenCalled();
    });

    it('only suggests opening a later round, by default', async () => {
      await service.onRoundStarted('333-r2');

      expect(calls()).not.toContain('PUT /rounds/333-r2/open');
      expect(appGateway.handleRoundShouldBeOpened).toHaveBeenCalledWith(
        '333-r2',
        [],
      );
    });

    it('opens a later round itself when opted in and nothing argues against it', async () => {
      competition.openRoundsAutomatically = true;

      await service.onRoundStarted('333-r2');

      expect(calls()).toContain('PUT /rounds/333-r2/open');
    });

    it('falls back to suggesting when the previous round is not done', async () => {
      competition.openRoundsAutomatically = true;
      previousResults = [
        {
          attempts: [],
          liveSync: { status: LiveSyncStatus.SENT },
        },
        {
          attempts: [
            {
              id: 'a1',
              attemptNumber: 1,
              status: AttemptStatus.EXTRA_GIVEN,
              type: AttemptType.STANDARD_ATTEMPT,
              replacedBy: null,
            },
          ],
          liveSync: { status: LiveSyncStatus.CONFIRMED },
        },
      ];

      await service.onRoundStarted('333-r2');

      expect(calls()).not.toContain('PUT /rounds/333-r2/open');
      const [, blockers] = appGateway.handleRoundShouldBeOpened.mock.calls[0];
      expect(blockers).toEqual([
        '1 result of 333-r1 not confirmed in WCA Integrated Live Results',
        '1 result of 333-r1 waiting for an extra',
      ]);
    });

    it('does nothing for a round that is already open', async () => {
      rounds[0].state = 'open';

      await service.onRoundStarted('333-r1');

      expect(calls()).toEqual(['GET /rounds']);
      expect(appGateway.handleRoundShouldBeOpened).not.toHaveBeenCalled();
    });

    it('explains a round the WCA keeps pending', async () => {
      rounds[1].state = 'pending';

      await service.onRoundStarted('333-r2');

      expect(appGateway.handleRoundShouldBeOpened).toHaveBeenCalledWith(
        '333-r2',
        ['The WCA is waiting for the previous round to be complete'],
      );
    });

    it('does nothing when results go somewhere else', async () => {
      competition.wcaScoretakingSoftware = 'wca_live';

      await service.onRoundStarted('333-r1');

      expect(connection.authorizedFetch).not.toHaveBeenCalled();
    });
  });

  it('passes on why the WCA refused to open a round', async () => {
    responses['PUT /rounds/333-r2/open'] = {
      status: 400,
      body: { status: 'score taking is not finished in the previous round' },
    };

    await expect(service.openRound('333-r2')).resolves.toEqual({
      ok: false,
      message: 'score taking is not finished in the previous round',
    });
    expect(sender.markRoundDirty).not.toHaveBeenCalled();
  });

  it('lists people registered for the event who are not in the round yet', async () => {
    responses['GET /rounds/333-r1/addable_competitors'] = {
      status: 200,
      body: {
        registrations: [
          {
            id: 1,
            user: { name: 'In Round' },
            competing: { event_ids: ['333'] },
          },
          {
            id: 2,
            user: { name: 'Missing', wca_id: '2020MISS01' },
            competing: { event_ids: ['333'] },
          },
          {
            id: 3,
            user: { name: 'Other Event' },
            competing: { event_ids: ['222'] },
          },
        ],
      },
    };
    responses['GET /rounds/333-r1'] = {
      status: 200,
      body: { results: [{ registration_id: 1, attempts: [] }] },
    };

    await expect(service.getAddableCompetitors('333-r1')).resolves.toEqual([
      { registrationId: 2, name: 'Missing', wcaId: '2020MISS01' },
    ]);
  });

  it('adds nobody by hand to a later round', async () => {
    await expect(service.getAddableCompetitors('333-r2')).resolves.toEqual([]);
    expect(connection.authorizedFetch).not.toHaveBeenCalled();
  });
});
