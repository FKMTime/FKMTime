import { AttemptStatus, AttemptType, LiveSyncStatus } from '@prisma/client';

import { IntegratedLiveRoundsService } from './integratedLiveRounds.service';

const WCA = 'https://wca.example';

describe('IntegratedLiveRoundsService', () => {
  const origin = process.env.WCA_ORIGIN;
  let competition: Record<string, unknown>;
  let previousResults: unknown[];
  let rooms: { currentGroupIds: string[] }[];
  let activities: Record<string, unknown>[];
  let persons: Record<string, unknown>[];
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
      wcif: {
        events: [
          {
            id: '333',
            rounds: [
              { id: '333-r1' },
              {
                id: '333-r2',
                participationRuleset: {
                  participationSource: {
                    type: 'round',
                    roundId: '333-r1',
                    resultCondition: { type: 'ranking', value: 8 },
                  },
                },
              },
            ],
          },
        ],
      },
    };
    previousResults = [];
    rooms = [];
    activities = [];
    persons = [];
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
    const byPerson = (where: Record<string, any>) => (a: Record<string, any>) =>
      (!where.personId || a.personId === where.personId) &&
      (!where.groupId?.startsWith ||
        String(a.groupId).startsWith(where.groupId.startsWith));
    const prisma = {
      competition: { findFirst: jest.fn(async () => competition) },
      result: { findMany: jest.fn(async () => previousResults) },
      room: { findMany: jest.fn(async () => rooms) },
      staffActivity: {
        findMany: jest.fn(async ({ where }) =>
          activities.filter(byPerson(where)).map((a) => ({
            ...a,
            person: persons.find((p) => p.id === a.personId),
          })),
        ),
        findFirst: jest.fn(
          async ({ where }) => activities.find(byPerson(where)) ?? null,
        ),
      },
      person: {
        findUnique: jest.fn(
          async ({ where }) => persons.find((p) => p.id === where.id) ?? null,
        ),
        findMany: jest.fn(async ({ where }) =>
          persons.filter((p) =>
            where.wcaRegistrationId.in.includes(p.wcaRegistrationId),
          ),
        ),
      },
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

  describe('no-shows', () => {
    beforeEach(() => {
      rounds = [{ id: '333-r1', state: 'open' }];
      persons = [
        { id: 'p-absent', name: 'Absent Example', wcaRegistrationId: 201 },
        { id: 'p-late', name: 'Late Example', wcaRegistrationId: 202 },
        { id: 'p-came', name: 'Came Example', wcaRegistrationId: 203 },
      ];
      activities = [
        { personId: 'p-absent', groupId: '333-r1-g1', status: 'ABSENT' },
        { personId: 'p-absent', groupId: '333-r1-g2', status: 'ABSENT' },
        { personId: 'p-late', groupId: '333-r1-g1', status: 'ABSENT' },
        { personId: 'p-late', groupId: '333-r1-g2', status: 'PRESENT' },
        { personId: 'p-came', groupId: '333-r1-g1', status: 'PRESENT' },
      ];
      previousResults = [{ personId: 'p-came', attempts: [{ id: 'a1' }] }];
      responses['GET /rounds/333-r1'] = {
        status: 200,
        body: {
          results: [
            { registration_id: 201, attempts: [] },
            { registration_id: 202, attempts: [] },
            { registration_id: 203, attempts: [{ value: 900 }] },
          ],
        },
      };
    });

    it('lists competitors absent from every group of a finished round', async () => {
      await expect(service.getNoShows()).resolves.toEqual([
        {
          roundId: '333-r1',
          competitors: [
            {
              personId: 'p-absent',
              name: 'Absent Example',
              registrationId: 201,
            },
          ],
        },
      ]);
    });

    it('waits while the round is still running in a room', async () => {
      rooms = [{ currentGroupIds: ['333-r1-g2'] }];

      await expect(service.getNoShows()).resolves.toEqual([]);
    });

    it('removes the ticked ones in one call, with nobody moving up', async () => {
      await service.removeNoShows('333-r1', [201]);

      const [url, init] = connection.authorizedFetch.mock.calls[0];
      expect(url).toMatch(/\/rounds\/333-r1\/bulk_quit$/);
      expect(init.method).toBe('DELETE');
      expect(JSON.parse(init.body as string)).toEqual({
        registration_ids: [201],
      });
    });
  });

  describe('withdrawals', () => {
    beforeEach(() => {
      rounds = [{ id: '333-r2', state: 'open' }];
      persons = [
        { id: 'p-anna', name: 'Anna Example', wcaRegistrationId: 201 },
        { id: 'p-jan', name: 'Jan Example', wcaRegistrationId: 301 },
      ];
      activities = [
        { personId: 'p-anna', groupId: '333-r2-g3', status: 'ABSENT' },
      ];
    });

    it('shows who is next in line, as the WCA says', async () => {
      responses['GET /rounds/333-r2/next_if_quit?registration_id=201'] = {
        status: 200,
        body: { next_advancing: [{ id: 301, name: 'Jan Example' }] },
      };

      await expect(
        service.previewWithdrawal('333-r2', 'p-anna'),
      ).resolves.toMatchObject({
        roundOpen: true,
        next: [{ registrationId: 301, name: 'Jan Example', personId: 'p-jan' }],
        nobodyReason: null,
      });
    });

    it('explains when nobody is next in line', async () => {
      responses['GET /rounds/333-r2/next_if_quit?registration_id=201'] = {
        status: 200,
        body: { next_advancing: [] },
      };

      const preview = await service.previewWithdrawal('333-r2', 'p-anna');

      expect(preview).toMatchObject({ next: [] });
      expect(preview.nobodyReason).toMatch(/Nobody is left to move up/);
    });

    it('explains that a result condition frees no place', async () => {
      (
        competition.wcif as any
      ).events[0].rounds[1].participationRuleset.participationSource.resultCondition =
        { type: 'resultAchieved', scope: 'single', value: 2000 };
      responses['GET /rounds/333-r2/next_if_quit?registration_id=201'] = {
        status: 200,
        body: { next_advancing: [] },
      };

      const preview = await service.previewWithdrawal('333-r2', 'p-anna');

      expect(preview.nobodyReason).toMatch(/by result, not by ranking/);
    });

    it('says the round must be open first', async () => {
      rounds[0].state = 'ready';

      await expect(
        service.previewWithdrawal('333-r2', 'p-anna'),
      ).resolves.toMatchObject({ roundOpen: false, roundState: 'ready' });
    });

    it('withdraws with the chosen replacements, and suggests the same group', async () => {
      const result = await service.withdraw('333-r2', 'p-anna', [301]);

      const [url, init] = connection.authorizedFetch.mock.calls[0];
      expect(url).toMatch(/\/rounds\/333-r2\/201$/);
      expect(JSON.parse(init.body as string)).toEqual({ advancing_ids: [301] });
      expect(result).toMatchObject({
        ok: true,
        replacements: [
          {
            personId: 'p-jan',
            name: 'Jan Example',
            suggestedGroupId: '333-r2-g3',
          },
        ],
      });
    });

    it('sends no replacements when nobody should advance', async () => {
      await service.withdraw('333-r2', 'p-anna', []);

      const [, init] = connection.authorizedFetch.mock.calls[0];
      expect(JSON.parse(init.body as string)).toEqual({});
    });

    it('asks again when the WCA has a different next in line', async () => {
      responses['DELETE /rounds/333-r2/201'] = {
        status: 400,
        body: {
          status:
            "The advancing competitor doesn't match who should be advancing.",
          should_advance: [{ registration_id: 302 }],
        },
      };

      await expect(
        service.withdraw('333-r2', 'p-anna', [301]),
      ).resolves.toMatchObject({
        ok: false,
        changed: true,
        next: [{ registrationId: 302, personId: null }],
      });
    });
  });

  it('clears a round on the WCA, then sends FKMTime results again', async () => {
    await service.clearRound('333-r1');

    expect(calls()).toContain('PUT /rounds/333-r1/clear');
    expect(sender.markRoundDirty).toHaveBeenCalledWith('333-r1');
  });
});
