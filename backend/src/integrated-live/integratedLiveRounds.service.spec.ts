import { AttemptStatus, AttemptType, LiveSyncStatus } from '@prisma/client';

import { IntegratedLiveRoundsService } from './integratedLiveRounds.service';

const WCA = 'https://wca.example';

describe('IntegratedLiveRoundsService', () => {
  const origin = process.env.WCA_ORIGIN;
  let competition: Record<string, unknown>;
  let previousResults: unknown[];
  let rooms: { currentGroupIds: string[]; startedGroupIds: string[] }[];
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
  let wcaService: { getCompetitionInfo: jest.Mock };

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
      result: {
        findMany: jest.fn(async () => previousResults),
        findFirst: jest.fn(
          async ({ where }) =>
            (previousResults as Record<string, any>[]).find(
              (r) =>
                r.person?.wcaRegistrationId === where.person?.wcaRegistrationId,
            ) ?? null,
        ),
      },
      liveSync: {
        findMany: jest.fn(async ({ where }) => {
          const matches = (
            sync: Record<string, any> | null,
            condition: Record<string, any>,
          ) =>
            !!sync &&
            condition.status.in.includes(sync.status) &&
            (!condition.updatedAt ||
              new Date(sync.updatedAt ?? 0) < condition.updatedAt.lt);
          return (previousResults as Record<string, any>[])
            .filter((r) =>
              (where.OR ?? [where]).some((c: Record<string, any>) =>
                matches(r.liveSync, c),
              ),
            )
            .map((r) => ({
              status: r.liveSync.status,
              error: r.liveSync.error ?? null,
              result: { roundId: r.roundId },
            }));
        }),
      },
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
    wcaService = {
      getCompetitionInfo: jest.fn(async () => ({
        event_change_deadline_date: '2026-11-10T23:00:00.000Z',
        on_the_spot_registration: true,
        competitor_limit: 60,
      })),
    };
    service = new IntegratedLiveRoundsService(
      prisma as never,
      connection as never,
      sender as never,
      appGateway as never,
      wcaService as never,
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
      rooms = [
        { currentGroupIds: [], startedGroupIds: ['333-r1-g1', '333-r1-g2'] },
      ];
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
      rooms = [
        {
          currentGroupIds: ['333-r1-g2'],
          startedGroupIds: ['333-r1-g1', '333-r1-g2'],
        },
      ];

      await expect(service.getNoShows()).resolves.toEqual([]);
    });

    it('waits while the round is paused before its last groups', async () => {
      // g1 ran, then the room moved on to another event; g2 hasn't started
      rooms = [
        { currentGroupIds: ['222-r1-g1'], startedGroupIds: ['333-r1-g1'] },
      ];

      await expect(service.getNoShows()).resolves.toEqual([]);
    });

    it('counts groups started in any room', async () => {
      rooms = [
        { currentGroupIds: [], startedGroupIds: ['333-r1-g1'] },
        { currentGroupIds: [], startedGroupIds: ['333-r1-g2'] },
      ];

      const [round] = await service.getNoShows();
      expect(round.competitors.map((c) => c.registrationId)).toEqual([201]);
    });

    it('removes the ticked ones in one call, with nobody moving up', async () => {
      await expect(service.removeNoShows('333-r1', [201])).resolves.toEqual(
        expect.objectContaining({ ok: true }),
      );

      const [url, init] = connection.authorizedFetch.mock.calls.find(
        ([calledUrl]) => String(calledUrl).endsWith('/bulk_quit'),
      );
      expect(url).toMatch(/\/rounds\/333-r1\/bulk_quit$/);
      expect(init.method).toBe('DELETE');
      expect(JSON.parse(init.body as string)).toEqual({
        registration_ids: [201],
      });
    });

    it.each([
      ['someone who came late', [202]],
      ['someone unknown', [999]],
      ['a mix', [201, 202]],
      ['nobody', []],
    ])('refuses to remove %s', async (_, ids) => {
      const result = await service.removeNoShows('333-r1', ids);

      expect(result.ok).toBe(false);
      expect(calls()).not.toContain('DELETE /rounds/333-r1/bulk_quit');
    });

    it('refuses while the round is paused', async () => {
      rooms = [{ currentGroupIds: [], startedGroupIds: ['333-r1-g1'] }];

      const result = await service.removeNoShows('333-r1', [201]);

      expect(result.ok).toBe(false);
      expect(calls()).not.toContain('DELETE /rounds/333-r1/bulk_quit');
    });
  });

  describe('Results page details', () => {
    const solve = (attemptNumber: number, value: number) => ({
      id: `a${attemptNumber}`,
      attemptNumber,
      value,
      penalty: 0,
      status: AttemptStatus.STANDARD,
      type: AttemptType.STANDARD_ATTEMPT,
      replacedBy: null,
    });
    const result = (
      id: string,
      registrationId: number,
      values: number[],
      status: LiveSyncStatus | null,
    ) => ({
      id,
      roundId: '333-r2',
      personId: `p-${id}`,
      person: { wcaRegistrationId: registrationId },
      attempts: values.map((value, i) => solve(i + 1, value)),
      liveSync: status ? { status, error: null, sentAt: null } : null,
    });

    beforeEach(() => {
      rounds = [
        {
          id: '333-r1',
          state: 'locked',
          total_competitors: 20,
        } as never,
        {
          id: '333-r2',
          state: 'open',
          total_competitors: 8,
          completed_competitors: 3,
        } as never,
      ];
      previousResults = [
        result('same', 301, [1000, 1100], LiveSyncStatus.CONFIRMED),
        result('different', 302, [900, 950], LiveSyncStatus.CONFIRMED),
        result('sending', 303, [800], LiveSyncStatus.SENT),
        result('rejected', 304, [700], LiveSyncStatus.REJECTED),
      ];
      responses['GET /rounds/333-r2'] = {
        status: 200,
        body: {
          competitors: [{ id: 305, name: 'Typed In Example', wca_id: null }],
          results: [
            {
              registration_id: 301,
              advancing: true,
              advancing_questionable: true,
              attempts: [
                { attempt_number: 2, value: 1100 },
                { attempt_number: 1, value: 1000 },
              ],
            },
            {
              registration_id: 302,
              advancing: false,
              advancing_questionable: true,
              attempts: [{ attempt_number: 1, value: 900 }],
            },
            {
              registration_id: 303,
              attempts: [],
            },
            {
              registration_id: 305,
              attempts: [{ attempt_number: 1, value: 1500 }],
            },
            { registration_id: 306, attempts: [] },
          ],
        },
      };
    });

    it('puts the WCA copy, flags and differences next to each result', async () => {
      const details = await service.getRoundDetails('333-r2');

      expect(details).toMatchObject({
        state: 'open',
        totalCompetitors: 8,
        completedCompetitors: 3,
        waitingReason: null,
        onTheWay: 1,
        needsAttention: 1,
      });
      const byId = Object.fromEntries(
        details.results.map((r) => [r.resultId, r]),
      );
      expect(byId.same).toMatchObject({
        advancing: 'advances',
        wcaAttempts: [1000, 1100],
        differs: false,
      });
      expect(byId.different).toMatchObject({
        advancing: 'mayAdvance',
        wcaAttempts: [900],
        differs: true,
      });
      // On its way: a difference is expected until it is read back
      expect(byId.sending).toMatchObject({ wcaAttempts: [], differs: false });
      expect(byId.rejected).toMatchObject({
        status: LiveSyncStatus.REJECTED,
        wcaAttempts: null,
        differs: false,
      });
    });

    it('lists results only the WCA has, but not empty ones', async () => {
      const details = await service.getRoundDetails('333-r2');

      expect(details.onlyInWca).toEqual([
        {
          registrationId: 305,
          name: 'Typed In Example',
          wcaId: null,
          attempts: [1500],
        },
      ]);
    });

    it('says why a round cannot open yet', async () => {
      rounds = [
        {
          id: '333-r1',
          state: 'open',
          total_competitors: 20,
          completed_competitors: 18,
        } as never,
        { id: '333-r2', state: 'pending' },
      ];

      await expect(service.getRoundDetails('333-r2')).resolves.toMatchObject({
        waitingReason: 'Waiting for 333-r1: 2 empty results',
      });
    });

    it('is empty when results do not go to WCA Integrated Live Results', async () => {
      competition.wcaScoretakingSoftware = 'wca_live';

      await expect(service.getRoundDetails('333-r2')).resolves.toBeNull();
      await expect(service.getRoundSummaries()).resolves.toEqual([]);
    });

    it('marks rounds with results to look at in the strip', async () => {
      const summaries = await service.getRoundSummaries();

      expect(
        summaries.map(({ roundId, dot, needsAttention }) => ({
          roundId,
          dot,
          needsAttention,
        })),
      ).toEqual([
        { roundId: '333-r1', dot: 'done', needsAttention: 0 },
        { roundId: '333-r2', dot: 'attention', needsAttention: 1 },
      ]);
    });

    it("clears one result and sends FKMTime's again", async () => {
      const outcome = await service.clearResult('333-r2', 302);

      expect(outcome.ok).toBe(true);
      expect(calls()).toContain('PUT /rounds/333-r2/302/clear');
      expect(sender.markDirty).toHaveBeenCalledWith(['different']);
    });

    it('clears a result only the WCA has without sending anything', async () => {
      const outcome = await service.clearResult('333-r2', 305);

      expect(outcome).toEqual({ ok: true, message: 'Cleared' });
      expect(sender.markDirty).not.toHaveBeenCalled();
    });
  });

  describe('Home problems', () => {
    const sync = (
      roundId: string,
      status: LiveSyncStatus,
      minutesAgo: number,
      error: string | null = null,
    ) => ({
      roundId,
      liveSync: {
        status,
        error,
        updatedAt: new Date(Date.now() - minutesAgo * 60_000),
      },
    });

    it('counts results stuck on their way and refused ones, by round', async () => {
      previousResults = [
        sync('333-r1', LiveSyncStatus.DIRTY, 10),
        sync('333-r1', LiveSyncStatus.SENT, 7),
        sync('333-r1', LiveSyncStatus.DIRTY, 1),
        sync('333-r1', LiveSyncStatus.CONFIRMED, 30),
        sync(
          '222-r1',
          LiveSyncStatus.REJECTED,
          0,
          'Attempts after a missed cutoff',
        ),
        sync(
          '222-r1',
          LiveSyncStatus.NOT_IN_ROUND,
          0,
          'No accepted WCA registration',
        ),
      ];

      await expect(service.getProblems()).resolves.toEqual({
        stuck: [{ roundId: '333-r1', count: 2 }],
        refused: [{ roundId: '222-r1', count: 2 }],
      });
    });

    it('leaves out results that only wait for their round to open', async () => {
      previousResults = [
        sync(
          '333-r2',
          LiveSyncStatus.NOT_IN_ROUND,
          20,
          'Round not open in WCA Integrated Live Results',
        ),
      ];

      await expect(service.getProblems()).resolves.toEqual({
        stuck: [],
        refused: [],
      });
    });

    it('reads the WCA rules behind "not registered" results', async () => {
      await expect(service.getRegistrationRules()).resolves.toEqual({
        eventChangeDeadline: '2026-11-10T23:00:00.000Z',
        onTheSpotRegistration: true,
        competitorLimit: 60,
      });
      expect(wcaService.getCompetitionInfo).toHaveBeenCalledWith(
        'ExampleOpen2026',
      );
    });

    it('has no rules when the WCA cannot be reached', async () => {
      wcaService.getCompetitionInfo.mockRejectedValue(new Error('offline'));

      await expect(service.getRegistrationRules()).resolves.toBeNull();
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
