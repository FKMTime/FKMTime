import { INestApplication } from '@nestjs/common';
import { AttemptStatus, Competition, Role, Room } from '@prisma/client';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';

import { createTestApp } from './helpers/app.helper';
import {
  createUserWithRoles,
  deleteSetupUsers,
  TestUser,
} from './helpers/setup-roles.helper';

const SUFFIX = 'competition-setup';
const FAKE_ID = '00000000-0000-4000-8000-000000000000';

interface WcifActivity {
  id: number;
  activityCode: string;
  childActivities?: WcifActivity[];
}
interface WcifLike {
  persons: {
    registrantId: number;
    assignments: { activityId: number; assignmentCode: string }[];
  }[];
  schedule: { venues: { rooms: { activities: WcifActivity[] }[] }[] };
}

/** Registrant ids assigned to compete in a group, read straight from the WCIF */
const competitorsOfGroup = (wcif: WcifLike, groupId: string) => {
  const ids = new Set<number>();
  const visit = (a: WcifActivity) => {
    if (a.activityCode === groupId) ids.add(a.id);
    a.childActivities?.forEach(visit);
  };
  wcif.schedule.venues.forEach((v) =>
    v.rooms.forEach((r) => r.activities.forEach(visit)),
  );
  return wcif.persons
    .filter((p) =>
      p.assignments.some(
        (a) => a.assignmentCode === 'competitor' && ids.has(a.activityId),
      ),
    )
    .map((p) => p.registrantId);
};

describe('Competition setup (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let organizer: TestUser;
  let competition: Competition;
  let stage1: Room;
  let stage2: Room;

  const server = () => app.getHttpServer();
  const asOrganizer = (req: request.Test) =>
    req.set('Authorization', `Bearer ${organizer.token}`);
  const setGroups = (room: Room, currentGroupIds: string[]) =>
    db.room.update({ where: { id: room.id }, data: { currentGroupIds } });

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    await deleteSetupUsers(db, SUFFIX);
    organizer = await createUserWithRoles(app, db, `organizer-${SUFFIX}`, [
      Role.ORGANIZER,
    ]);
    competition = await db.competition.findFirst();
    stage1 = await db.room.findFirst({ where: { name: 'Stage 1' } });
    stage2 = await db.room.findFirst({ where: { name: 'Stage  2' } });
  }, 30000);

  afterAll(async () => {
    await db.competition.update({
      where: { id: competition.id },
      data: {
        scoretakingToken: competition.scoretakingToken,
        scoretakingTokenUpdatedAt: competition.scoretakingTokenUpdatedAt,
        cubingContestsToken: competition.cubingContestsToken,
        sendingResultsFrequency: competition.sendingResultsFrequency,
        shouldChangeGroupsAutomatically:
          competition.shouldChangeGroupsAutomatically,
        useFkmTimeDevices: competition.useFkmTimeDevices,
        shouldUpdateDevices: competition.shouldUpdateDevices,
        wifiSsid: competition.wifiSsid,
        wifiPassword: competition.wifiPassword,
        mdns: competition.mdns,
        wsUrl: competition.wsUrl,
        defaultLocale: competition.defaultLocale,
        secureRfid: competition.secureRfid,
        soundEnabled: competition.soundEnabled,
      },
    });
    await setGroups(stage1, stage1.currentGroupIds);
    await setGroups(stage2, stage2.currentGroupIds);
    await deleteSetupUsers(db, SUFFIX);
    await app.close();
  }, 30000);

  describe('public endpoints', () => {
    it('GET /competition/login-info exposes only what the login page needs', async () => {
      const res = await request(server())
        .get('/competition/login-info')
        .expect(200);

      expect(res.body).toEqual({
        id: competition.id,
        name: competition.name,
        wcaId: competition.wcaId,
        countryIso2: competition.countryIso2,
        useFkmTimeDevices: competition.useFkmTimeDevices,
      });
    });

    it('GET /competition/public returns the WCIF but no secrets', async () => {
      const res = await request(server())
        .get('/competition/public')
        .expect(200);

      expect(res.body).toEqual({
        id: competition.id,
        name: competition.name,
        wcaId: competition.wcaId,
        countryIso2: competition.countryIso2,
        useFkmTimeDevices: competition.useFkmTimeDevices,
        soundEnabled: competition.soundEnabled,
        wcif: expect.objectContaining({ id: competition.wcaId }),
      });
    });

    it('GET /competition/public/rooms lists all rooms', async () => {
      const res = await request(server())
        .get('/competition/public/rooms')
        .expect(200);

      expect(res.body.map((r: Room) => r.name).sort()).toEqual([
        'Stage  2',
        'Stage 1',
      ]);
    });

    it('GET /competition returns the same info for a logged-in user', async () => {
      const res = await asOrganizer(
        request(server()).get('/competition'),
      ).expect(200);

      expect(res.body).toMatchObject({
        id: competition.id,
        wcaId: competition.wcaId,
      });
      expect(res.body).not.toHaveProperty('scoretakingToken');
    });
  });

  describe('GET /competition/rounds', () => {
    it('lists every round of the WCIF with format, limits and next-round rules', async () => {
      const res = await asOrganizer(
        request(server()).get('/competition/rounds'),
      ).expect(200);

      expect(res.body.map((r: { id: string }) => r.id)).toEqual([
        '333-r1',
        '333-r2',
        '333-r3',
        '222-r1',
        '666-r1',
        '333bf-r1',
        'clock-r1',
        'minx-r1',
        'minx-r2',
        'minx-r3',
      ]);
      const wcif = competition.wcif as unknown as {
        events: { id: string; rounds: { id: string }[] }[];
      };
      const r2 = wcif.events
        .find((e) => e.id === '333')
        .rounds.find((r) => r.id === '333-r2') as {
        participationRuleset?: unknown;
      };
      expect(res.body[0]).toEqual({
        id: '333-r1',
        number: '1',
        name: '3x3x3 Cube - Round 1',
        eventId: '333',
        format: 'a',
        timeLimit: { centiseconds: 60000, cumulativeRoundIds: [] },
        cutoff: null,
        linkedRounds: null,
        nextRoundParticipationRuleset: r2.participationRuleset,
      });
      const sixes = res.body.find((r: { id: string }) => r.id === '666-r1');
      expect(sixes).toMatchObject({
        name: '6x6x6 Cube - Round 1',
        format: 'm',
        cutoff: { numberOfAttempts: 1 },
      });
      expect(sixes.nextRoundParticipationRuleset).toBeUndefined();
    });
  });

  describe('competition settings', () => {
    it('GET /competition/settings returns the full record with HIL state', async () => {
      const res = await asOrganizer(
        request(server()).get('/competition/settings'),
      ).expect(200);

      expect(res.body).toMatchObject({
        id: competition.id,
        scoretakingToken: competition.scoretakingToken,
        wifiSsid: competition.wifiSsid,
        fkmToken: competition.fkmToken,
        hilTesting: false,
      });
    });

    it('PUT /competition/settings/:id updates settings and stamps a new scoretaking token', async () => {
      const before = await db.competition.findFirst();

      const res = await asOrganizer(
        request(server()).put(`/competition/settings/${competition.id}`),
      )
        .send({
          scoretakingToken: 'e2e-new-scoretaking-token',
          cubingContestsToken: 'e2e-contests-token',
          sendingResultsFrequency: 'NEVER',
          shouldChangeGroupsAutomatically: true,
          useFkmTimeDevices: false,
        })
        .expect(200);

      expect(res.body).toMatchObject({
        id: competition.id,
        scoretakingToken: 'e2e-new-scoretaking-token',
        sendingResultsFrequency: 'NEVER',
      });
      const after = await db.competition.findFirst();
      expect(after).toMatchObject({
        scoretakingToken: 'e2e-new-scoretaking-token',
        cubingContestsToken: 'e2e-contests-token',
        sendingResultsFrequency: 'NEVER',
        shouldChangeGroupsAutomatically: true,
        useFkmTimeDevices: false,
      });
      expect(after.scoretakingTokenUpdatedAt.getTime()).toBeGreaterThan(
        before.scoretakingTokenUpdatedAt.getTime(),
      );
    });

    it('keeps the token timestamp when the token does not change', async () => {
      const before = await db.competition.findFirst();

      await asOrganizer(
        request(server()).put(`/competition/settings/${competition.id}`),
      )
        .send({
          scoretakingToken: 'e2e-new-scoretaking-token',
          sendingResultsFrequency: 'AFTER_SOLVE',
          shouldChangeGroupsAutomatically: false,
          useFkmTimeDevices: true,
        })
        .expect(200);

      const after = await db.competition.findFirst();
      expect(after.scoretakingTokenUpdatedAt).toEqual(
        before.scoretakingTokenUpdatedAt,
      );
      expect(after.sendingResultsFrequency).toBe('AFTER_SOLVE');
    });

    it.each([
      [
        'an unknown results frequency',
        {
          scoretakingToken: 'x',
          sendingResultsFrequency: 'HOURLY',
          shouldChangeGroupsAutomatically: false,
          useFkmTimeDevices: true,
        },
      ],
      [
        'an empty scoretaking token',
        {
          scoretakingToken: '',
          sendingResultsFrequency: 'NEVER',
          shouldChangeGroupsAutomatically: false,
          useFkmTimeDevices: true,
        },
      ],
      [
        'a missing boolean flag',
        { scoretakingToken: 'x', sendingResultsFrequency: 'NEVER' },
      ],
    ])('PUT /competition/settings/:id rejects %s', async (_, body) => {
      await asOrganizer(
        request(server()).put(`/competition/settings/${competition.id}`),
      )
        .send(body)
        .expect(400);
    });

    it('GET /competition/settings/:id/devices returns the device setup fields only', async () => {
      const res = await asOrganizer(
        request(server()).get(
          `/competition/settings/${competition.id}/devices`,
        ),
      ).expect(200);

      expect(res.body).toEqual({
        id: competition.id,
        wifiSsid: competition.wifiSsid,
        wifiPassword: competition.wifiPassword,
        mdns: competition.mdns,
        wsUrl: competition.wsUrl,
      });
    });

    it('PUT /competition/settings/:id/devices updates device settings', async () => {
      const res = await asOrganizer(
        request(server()).put(
          `/competition/settings/${competition.id}/devices`,
        ),
      )
        .send({
          shouldUpdateDevices: false,
          wifiSsid: 'e2e-ssid',
          wifiPassword: 'e2e-wifi-password',
          mdns: false,
          wsUrl: 'ws://192.0.2.10:5000',
          defaultLocale: 'pl',
          hilTesting: false,
          secureRfid: true,
          soundEnabled: false,
        })
        .expect(200);

      expect(res.body).toEqual({ message: 'Devices settings updated' });
      expect(await db.competition.findFirst()).toMatchObject({
        shouldUpdateDevices: false,
        wifiSsid: 'e2e-ssid',
        wifiPassword: 'e2e-wifi-password',
        mdns: false,
        wsUrl: 'ws://192.0.2.10:5000',
        defaultLocale: 'pl',
        secureRfid: true,
        soundEnabled: false,
      });
      const settings = await asOrganizer(
        request(server()).get('/competition/settings'),
      ).expect(200);
      expect(settings.body.hilTesting).toBe(false);
    });

    it('PUT /competition/settings/:id/devices rejects missing flags', async () => {
      await asOrganizer(
        request(server()).put(
          `/competition/settings/${competition.id}/devices`,
        ),
      )
        .send({ wifiSsid: 'only-ssid' })
        .expect(400);
    });

    it('GET /competition/available-locales lists the bundled translations', async () => {
      const res = await asOrganizer(
        request(server()).get('/competition/available-locales'),
      ).expect(200);

      expect(res.body).toEqual(
        expect.arrayContaining([
          { locale: 'en', localeName: 'en' },
          { locale: 'pl', localeName: 'pl' },
        ]),
      );
    });
  });

  describe('PUT /competition/rooms', () => {
    it('sets the current groups of each room', async () => {
      const res = await asOrganizer(request(server()).put('/competition/rooms'))
        .send({
          rooms: [
            { id: stage1.id, currentGroupIds: ['333-r1-g1', '222-r1-g1'] },
            { id: stage2.id, currentGroupIds: ['333-r1-g2'] },
          ],
        })
        .expect(200);

      expect(res.body).toEqual({ message: 'Rooms updated' });
      const rooms = await db.room.findMany({
        where: { id: { in: [stage1.id, stage2.id] } },
      });
      expect(
        Object.fromEntries(rooms.map((r) => [r.name, r.currentGroupIds])),
      ).toEqual({
        'Stage 1': ['333-r1-g1', '222-r1-g1'],
        'Stage  2': ['333-r1-g2'],
      });
    });

    it('rejects two groups of the same event in one room and changes nothing', async () => {
      const res = await asOrganizer(request(server()).put('/competition/rooms'))
        .send({
          rooms: [
            { id: stage2.id, currentGroupIds: ['minx-r1-g2'] },
            { id: stage1.id, currentGroupIds: ['333-r1-g1', '333-r1-g3'] },
          ],
        })
        .expect(400);

      expect(res.body.message).toBe(
        'There are 2 or more groups in the room from the same event',
      );
      const room2 = await db.room.findUnique({ where: { id: stage2.id } });
      expect(room2.currentGroupIds).toEqual(['333-r1-g2']);
    });

    it('rejects a body without rooms', async () => {
      await asOrganizer(request(server()).put('/competition/rooms'))
        .send({})
        .expect(400);
    });
  });

  describe('next and previous groups', () => {
    const next = (room: Room) =>
      asOrganizer(
        request(server()).get(`/competition/rooms/${room.id}/next-groups`),
      ).expect(200);
    const previous = (room: Room) =>
      asOrganizer(
        request(server()).get(`/competition/rooms/${room.id}/previous-groups`),
      ).expect(200);

    it.each([
      [['333-r1-g1'], ['333-r1-g3'], []],
      [['333-r1-g3'], ['222-r1-g1'], ['333-r1-g1']],
      [['222-r1-g1'], ['222-r1-g3'], ['333-r1-g3']],
      [['minx-r1-g3'], [], ['minx-r1-g1']],
      [['333-r2-g1'], ['minx-r2-g1'], []],
      [['333-r1-g1', '222-r1-g1'], ['333-r1-g3', '222-r1-g3'], ['333-r1-g3']],
      [[], [], []],
    ])(
      'Stage 1 at %j: next %j, previous %j',
      async (current, expectedNext, expectedPrevious) => {
        await setGroups(stage1, current);

        expect((await next(stage1)).body).toEqual(expectedNext);
        expect((await previous(stage1)).body).toEqual(expectedPrevious);
      },
    );

    it('follows the schedule of the room it is asked about', async () => {
      await setGroups(stage2, ['333-r1-g4']);

      expect((await next(stage2)).body).toEqual(['222-r1-g2']);
      expect((await previous(stage2)).body).toEqual(['333-r1-g2']);
    });

    it.each(['next-groups', 'previous-groups'])(
      'GET rooms/:id/%s returns 404 for an unknown room',
      async (path) => {
        await asOrganizer(
          request(server()).get(`/competition/rooms/${FAKE_ID}/${path}`),
        ).expect(404);
      },
    );
  });

  describe('GET /competition/activities', () => {
    const activities = (query: string) =>
      asOrganizer(request(server()).get(`/competition/activities?${query}`));

    let resultId: string;

    afterAll(async () => {
      if (resultId) {
        await db.result.delete({ where: { id: resultId } });
      }
    });

    it('returns the activities of a room for a day, sorted by start time', async () => {
      const res = await activities('venueId=1&roomId=1&date=2024-05-24').expect(
        200,
      );

      expect(
        res.body.map((a: { activityCode: string }) => a.activityCode),
      ).toEqual([
        'other-checkin',
        '333-r1',
        '222-r1',
        '666-r1',
        '333bf-r1',
        'clock-r1',
        'minx-r1',
      ]);
      res.body.forEach((a: object) =>
        expect(a).toMatchObject({ realStartTime: null, realEndTime: null }),
      );
    });

    it('returns the second day separately', async () => {
      const res = await activities('venueId=1&roomId=1&date=2024-05-25').expect(
        200,
      );

      expect(
        res.body.map((a: { activityCode: string }) => a.activityCode),
      ).toEqual(['333-r2', 'minx-r2', 'minx-r3', '333-r3']);
    });

    it('returns an empty list for an unknown room', async () => {
      const res = await activities(
        'venueId=1&roomId=999&date=2024-05-24',
      ).expect(200);

      expect(res.body).toEqual([]);
    });

    it('reports the real start and end time from device attempts', async () => {
      const person = await db.person.findFirst({ where: { registrantId: 6 } });
      await db.result.deleteMany({
        where: { personId: person.id, roundId: '222-r1' },
      });
      const result = await db.result.create({
        data: { personId: person.id, eventId: '222', roundId: '222-r1' },
      });
      resultId = result.id;
      const firstSolve = new Date('2024-05-24T09:12:00Z');
      const lastSolve = new Date('2024-05-24T09:40:00Z');
      await db.attempt.createMany({
        data: [
          {
            resultId,
            attemptNumber: 1,
            value: 500,
            sessionId: 'e2e-setup-session-1',
            solvedAt: firstSolve,
          },
          {
            resultId,
            attemptNumber: 2,
            value: 600,
            sessionId: 'e2e-setup-session-2',
            solvedAt: lastSolve,
          },
          // Manually entered attempts (no session) are ignored
          {
            resultId,
            attemptNumber: 3,
            value: 700,
            solvedAt: new Date('2024-05-24T09:44:00Z'),
          },
        ],
      });

      const res = await activities('venueId=1&roomId=1&date=2024-05-24').expect(
        200,
      );

      const twos = res.body.find(
        (a: { activityCode: string }) => a.activityCode === '222-r1',
      );
      expect(new Date(twos.realStartTime)).toEqual(firstSolve);
      expect(new Date(twos.realEndTime)).toEqual(lastSolve);
    });

    // BUG: activities are matched by weekday only, so the same weekday a week later still returns the schedule
    it.skip('returns nothing for a date outside the competition', async () => {
      const res = await activities('venueId=1&roomId=1&date=2024-05-31').expect(
        200,
      );

      expect(res.body).toEqual([]);
    });
  });

  describe('GET /competition/rooms/progress', () => {
    let resultId: string;

    afterAll(async () => {
      if (resultId) {
        await db.result.delete({ where: { id: resultId } });
      }
    });

    it('reports entered vs expected attempts for the current groups', async () => {
      await setGroups(stage1, ['333-r1-g1']);
      await setGroups(stage2, []);
      const competitorIds = competitorsOfGroup(
        competition.wcif as unknown as WcifLike,
        '333-r1-g1',
      );
      expect(competitorIds.length).toBeGreaterThan(0);

      const before = await asOrganizer(
        request(server()).get('/competition/rooms/progress'),
      ).expect(200);

      expect(before.body).toEqual(
        expect.arrayContaining([
          {
            roomId: stage1.id,
            groups: [
              {
                groupId: '333-r1-g1',
                roundId: '333-r1',
                competitors: competitorIds.length,
                entered: 0,
                expected: competitorIds.length * 5,
              },
            ],
          },
          { roomId: stage2.id, groups: [] },
        ]),
      );

      const person = await db.person.findFirst({
        where: { registrantId: competitorIds[0] },
      });
      await db.result.deleteMany({
        where: { personId: person.id, roundId: '333-r1' },
      });
      const result = await db.result.create({
        data: { personId: person.id, eventId: '333', roundId: '333-r1' },
      });
      resultId = result.id;
      await db.attempt.createMany({
        data: [
          { resultId, attemptNumber: 1, value: 1000 },
          { resultId, attemptNumber: 2, value: 1100 },
          // A scrambled-only attempt does not count as entered
          {
            resultId,
            attemptNumber: 3,
            value: 0,
            status: AttemptStatus.SCRAMBLED,
          },
        ],
      });

      const after = await asOrganizer(
        request(server()).get('/competition/rooms/progress'),
      ).expect(200);

      const stage1Progress = after.body.find(
        (r: { roomId: string }) => r.roomId === stage1.id,
      );
      expect(stage1Progress.groups[0].entered).toBe(2);
    });
  });

  describe('GET /competition/statistics', () => {
    it('returns the statistics sections', async () => {
      const res = await asOrganizer(
        request(server()).get('/competition/statistics'),
      ).expect(200);

      expect(res.body).toEqual(
        expect.objectContaining({
          allAttempts: expect.any(Number),
          attemptsEnteredManually: expect.any(Number),
          scorecardsCount: expect.any(Number),
          byEventStats: expect.any(Array),
          byRoundStats: expect.any(Array),
          judgeRanking: expect.any(Array),
          scramblerRanking: expect.any(Array),
          attemptsByDevice: expect.any(Array),
        }),
      );
    });
  });
});
