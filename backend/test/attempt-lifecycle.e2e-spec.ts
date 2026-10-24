import { INestApplication } from '@nestjs/common';
import {
  AttemptStatus,
  AttemptType,
  Device,
  DeviceType,
  Person,
  StaffActivityStatus,
  StaffRole,
} from '@prisma/client';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';

import { createTestApp } from './helpers/app.helper';
import {
  createRoleUsers,
  createTestPersons,
  deleteTestPersons,
  RoleUsers,
  stubExternalApis,
} from './helpers/competition-day.helper';

const PREFIX = 'e2e-attempt-life';
const REGISTRANT_IDS = [9401, 9402, 9403, 9404];
const ROUND_ID = '333-r2';
const ASSIGNED_GROUP = `${ROUND_ID}-g2`;
const DEVICE_NAME = 'E2E Attempt Lifecycle Station';
const DEVICE_ESP_ID = 990401;
const NON_EXISTENT_ID = '00000000-0000-0000-0000-000000000000';

describe('Attempt lifecycle and edit log (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let users: RoleUsers;
  let delegate: string;
  let stub: ReturnType<typeof stubExternalApis>;
  let competitor: Person;
  let walkIn: Person;
  let judge: Person;
  let other: Person;
  let device: Device;

  const server = () => app.getHttpServer();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const attemptBody = (overrides: Record<string, unknown> = {}) => ({
    attemptNumber: 1,
    value: 1000,
    penalty: 0,
    roundId: ROUND_ID,
    competitorId: competitor.id,
    status: AttemptStatus.STANDARD,
    type: AttemptType.STANDARD_ATTEMPT,
    ...overrides,
  });

  const createAttempt = async (overrides: Record<string, unknown> = {}) => {
    const body = attemptBody(overrides);
    await request(server())
      .post('/attempt')
      .set(auth(delegate))
      .send(body)
      .expect(201);
    return db.attempt.findFirst({
      where: {
        result: { personId: body.competitorId as string, roundId: ROUND_ID },
        attemptNumber: body.attemptNumber,
        type: body.type,
      },
    });
  };

  const editLog = async (attemptId: string) =>
    (
      await request(server())
        .get(`/attempt/${attemptId}/edit-log`)
        .set(auth(delegate))
        .expect(200)
    ).body;

  const clearResults = async () => {
    await db.noteworthyIncident.deleteMany({
      where: {
        attempt: {
          result: {
            personId: { in: [competitor.id, walkIn.id, other.id] },
          },
        },
      },
    });
    await db.result.deleteMany({
      where: { personId: { in: [competitor.id, walkIn.id, other.id] } },
    });
    stub.reset();
  };

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    users = await createRoleUsers(app, db, PREFIX);
    delegate = users.tokens.DELEGATE;
    stub = stubExternalApis();
    [competitor, walkIn, judge, other] = await createTestPersons(
      db,
      'Lifecycle',
      REGISTRANT_IDS,
    );
    await db.staffActivity.create({
      data: {
        personId: competitor.id,
        groupId: ASSIGNED_GROUP,
        role: StaffRole.COMPETITOR,
        isAssigned: true,
      },
    });
    await db.device.deleteMany({ where: { name: DEVICE_NAME } });
    const room = await db.room.findFirst();
    device = await db.device.create({
      data: {
        name: DEVICE_NAME,
        espId: DEVICE_ESP_ID,
        type: DeviceType.STATION,
        roomId: room.id,
      },
    });
  }, 30000);

  afterAll(async () => {
    try {
      stub.restore();
      await deleteTestPersons(db, { registrantIds: REGISTRANT_IDS });
      await db.device.deleteMany({ where: { id: device.id } });
      await users.cleanup();
    } finally {
      await app.close();
    }
  }, 30000);

  describe('POST /attempt', () => {
    afterAll(clearResults);

    it('stores the attempt, logs it and submits the scorecard', async () => {
      const attempt = await createAttempt({
        value: 1234,
        penalty: 2,
        judgeId: judge.id,
        scramblerId: other.id,
        deviceId: device.id,
        comment: 'E2E typed from paper',
      });

      expect(attempt).toMatchObject({
        value: 1234,
        penalty: 2,
        judgeId: judge.id,
        scramblerId: other.id,
        deviceId: device.id,
        comment: 'E2E typed from paper',
        updatedById: users.userIds.DELEGATE,
        status: AttemptStatus.STANDARD,
      });
      expect(attempt.solvedAt).not.toBeNull();

      const log = await editLog(attempt.id);
      expect(log).toHaveLength(1);
      expect(log[0]).toMatchObject({
        comment: 'Manually entered',
        value: 1234,
        penalty: 2,
        attemptNumber: 1,
        editedBy: { id: users.userIds.DELEGATE, fullName: 'E2E DELEGATE' },
        judge: { id: judge.id, name: judge.name },
        scrambler: { id: other.id, name: other.name },
        device: { id: device.id, name: DEVICE_NAME },
        attemptComment: 'E2E typed from paper',
      });

      // +2 is sent to WCA Live as time + 2 seconds
      expect(stub.lastAttemptsFor(competitor.registrantId, ROUND_ID)).toEqual([
        1434,
      ]);
    });

    it('marks the competitor present in their assigned group', async () => {
      const activity = await db.staffActivity.findUnique({
        where: {
          personId_groupId_role: {
            personId: competitor.id,
            groupId: ASSIGNED_GROUP,
            role: StaffRole.COMPETITOR,
          },
        },
      });
      expect(activity.status).toBe(StaffActivityStatus.PRESENT);
      expect(activity.deviceId).toBe(device.id);
    });

    it('puts a competitor without an assignment into group 1', async () => {
      await createAttempt({ competitorId: walkIn.id });

      const activities = await db.staffActivity.findMany({
        where: { personId: walkIn.id },
      });
      expect(activities).toHaveLength(1);
      expect(activities[0]).toMatchObject({
        groupId: `${ROUND_ID}-g1`,
        role: StaffRole.COMPETITOR,
        status: StaffActivityStatus.PRESENT,
        isAssigned: false,
      });
    });

    it('does not submit an attempt that is waiting for an extra', async () => {
      stub.reset();
      await createAttempt({
        competitorId: walkIn.id,
        attemptNumber: 2,
        status: AttemptStatus.EXTRA_GIVEN,
      });
      expect(stub.submissions).toHaveLength(0);
    });

    it('rejects the competitor judging themselves', async () => {
      const res = await request(server())
        .post('/attempt')
        .set(auth(delegate))
        .send(attemptBody({ attemptNumber: 5, judgeId: competitor.id }))
        .expect(400);

      expect(res.body.message).toBe(
        'Judge cannot be the same person as competitor',
      );
      expect(
        await db.attempt.count({
          where: { result: { personId: competitor.id }, attemptNumber: 5 },
        }),
      ).toBe(0);
    });

    it('does not leave an empty result behind when rejected', async () => {
      await request(server())
        .post('/attempt')
        .set(auth(delegate))
        .send(attemptBody({ competitorId: other.id, judgeId: other.id }))
        .expect(400);

      expect(
        await db.result.count({
          where: { personId: other.id, roundId: ROUND_ID },
        }),
      ).toBe(0);
    });

    it('validates the body', async () => {
      await request(server())
        .post('/attempt')
        .set(auth(delegate))
        .send(attemptBody({ roundId: 'not-a-round', status: 'MAYBE' }))
        .expect(400);
    });
  });

  describe('editing an attempt', () => {
    let first: any;
    let second: any;
    let third: any;

    beforeAll(async () => {
      first = await createAttempt({ attemptNumber: 1, value: 1100 });
      second = await createAttempt({ attemptNumber: 2, value: 1200 });
      third = await createAttempt({ attemptNumber: 3, value: 1300 });
    });

    afterAll(clearResults);

    it('PUT /attempt/:id updates the attempt and logs the new state', async () => {
      const res = await request(server())
        .put(`/attempt/${first.id}`)
        .set(auth(delegate))
        .send({
          attemptNumber: 1,
          value: 1150,
          penalty: -1,
          status: AttemptStatus.STANDARD,
          type: AttemptType.STANDARD_ATTEMPT,
          judgeId: judge.id,
          comment: 'E2E DNF after review',
        })
        .expect(200);

      expect(res.body).toMatchObject({
        id: first.id,
        value: 1150,
        penalty: -1,
        judgeId: judge.id,
      });
      const log = await editLog(first.id);
      expect(log.map((l: any) => l.comment)).toEqual([
        'Manually entered',
        'Updated',
      ]);
      expect(log[0]).toMatchObject({ value: 1100, penalty: 0 });
      expect(log[1]).toMatchObject({
        value: 1150,
        penalty: -1,
        attemptComment: 'E2E DNF after review',
        judge: { id: judge.id },
        editedBy: { id: users.userIds.DELEGATE },
      });
      expect(stub.lastAttemptsFor(competitor.registrantId, ROUND_ID)).toEqual([
        -1, 1200, 1300,
      ]);
    });

    it('rejects moving an attempt onto a taken number', async () => {
      await request(server())
        .put(`/attempt/${first.id}`)
        .set(auth(delegate))
        .send({
          attemptNumber: 2,
          value: 1150,
          penalty: 0,
          status: AttemptStatus.STANDARD,
          type: AttemptType.STANDARD_ATTEMPT,
        })
        .expect(409);
      const unchanged = await db.attempt.findUnique({
        where: { id: first.id },
      });
      expect(unchanged.attemptNumber).toBe(1);
    });

    it('returns 404 for an unknown attempt', async () => {
      await request(server())
        .put(`/attempt/${NON_EXISTENT_ID}`)
        .set(auth(delegate))
        .send({
          attemptNumber: 1,
          value: 1,
          penalty: 0,
          status: AttemptStatus.STANDARD,
          type: AttemptType.STANDARD_ATTEMPT,
        })
        .expect(404);
    });

    it('PUT /attempt/swap swaps numbers and logs both attempts', async () => {
      await request(server())
        .put('/attempt/swap')
        .set(auth(delegate))
        .send({ firstAttemptId: second.id, secondAttemptId: third.id })
        .expect(200);

      const [s, t] = await Promise.all([
        db.attempt.findUnique({ where: { id: second.id } }),
        db.attempt.findUnique({ where: { id: third.id } }),
      ]);
      expect(s.attemptNumber).toBe(3);
      expect(t.attemptNumber).toBe(2);

      const secondLog = await editLog(second.id);
      expect(secondLog[secondLog.length - 1]).toMatchObject({
        comment: 'Swapped with attempt 2',
        attemptNumber: 3,
      });
      const thirdLog = await editLog(third.id);
      expect(thirdLog[thirdLog.length - 1]).toMatchObject({
        comment: 'Swapped with attempt 3',
        attemptNumber: 2,
      });
    });

    it('PUT /attempt/reorder renumbers, logs and resubmits in the new order', async () => {
      stub.reset();
      const result = await db.result.findFirst({
        where: { personId: competitor.id, roundId: ROUND_ID },
      });

      await request(server())
        .put('/attempt/reorder')
        .set(auth(delegate))
        .send({
          attemptIds: [second.id, third.id, first.id],
          resultId: result.id,
        })
        .expect(200);

      const attempts = await db.attempt.findMany({
        where: { resultId: result.id },
        orderBy: { attemptNumber: 'asc' },
      });
      expect(attempts.map((a) => a.id)).toEqual([
        second.id,
        third.id,
        first.id,
      ]);
      const log = await editLog(first.id);
      expect(log[log.length - 1]).toMatchObject({
        comment: 'Reordered',
        attemptNumber: 3,
      });
      expect(stub.lastAttemptsFor(competitor.registrantId, ROUND_ID)).toEqual([
        1200, 1300, -1,
      ]);
    });
  });

  describe('incidents and extras', () => {
    let resultId: string;

    const unresolvedAttempt = async (attemptNumber: number, comment: string) =>
      db.attempt.create({
        data: {
          resultId,
          attemptNumber,
          value: 1500,
          penalty: 0,
          status: AttemptStatus.UNRESOLVED,
          type: AttemptType.STANDARD_ATTEMPT,
          deviceId: device.id,
          judgeId: judge.id,
          solvedAt: new Date(),
          comment,
        },
      });

    beforeAll(async () => {
      await createAttempt({ attemptNumber: 1, value: 1000 });
      resultId = (
        await db.result.findFirst({
          where: { personId: competitor.id, roundId: ROUND_ID },
        })
      ).id;
    });

    afterAll(clearResults);

    it('resolves an incident and saves it as noteworthy', async () => {
      const incident = await unresolvedAttempt(2, 'E2E puzzle popped');

      await request(server())
        .put(`/attempt/${incident.id}`)
        .set(auth(delegate))
        .send({
          attemptNumber: 2,
          value: 1500,
          penalty: 2,
          status: AttemptStatus.RESOLVED,
          type: AttemptType.STANDARD_ATTEMPT,
          comment: 'E2E puzzle popped',
          noteworthy: true,
        })
        .expect(200);

      const resolved = await db.attempt.findUnique({
        where: { id: incident.id },
      });
      expect(resolved.status).toBe(AttemptStatus.RESOLVED);
      const noteworthy = await db.noteworthyIncident.findFirst({
        where: { attemptId: incident.id },
      });
      expect(noteworthy).toMatchObject({
        title: `${competitor.name} - 3x3x3 Cube, Round 2`,
        description: 'E2E puzzle popped',
        createdById: users.userIds.DELEGATE,
      });
      // A resolved incident counts as a normal attempt
      expect(stub.lastAttemptsFor(competitor.registrantId, ROUND_ID)).toEqual([
        1000, 1700,
      ]);
    });

    it('gives an extra and counts the extra in place of the attempt', async () => {
      const incident = await unresolvedAttempt(3, 'E2E timer malfunction');

      await request(server())
        .put(`/attempt/${incident.id}`)
        .set(auth(delegate))
        .send({
          attemptNumber: 3,
          value: 1500,
          penalty: 0,
          status: AttemptStatus.EXTRA_GIVEN,
          type: AttemptType.STANDARD_ATTEMPT,
        })
        .expect(200);

      // The extra attempt is solved later and entered as E1
      const extra = await createAttempt({
        attemptNumber: 1,
        value: 1111,
        type: AttemptType.EXTRA_ATTEMPT,
      });
      expect(extra.type).toBe(AttemptType.EXTRA_ATTEMPT);

      await request(server())
        .put(`/attempt/${incident.id}/replacement`)
        .set(auth(delegate))
        .send({ replacedByExtraNumber: 1 })
        .expect(200);

      const replaced = await db.attempt.findUnique({
        where: { id: incident.id },
      });
      expect(replaced).toMatchObject({
        status: AttemptStatus.EXTRA_GIVEN,
        replacedBy: 1,
      });
      const log = await editLog(incident.id);
      expect(log[log.length - 1]).toMatchObject({
        comment: 'Replacement set',
        replacedBy: 1,
      });
      expect(stub.lastAttemptsFor(competitor.registrantId, ROUND_ID)).toEqual([
        1000, 1700, 1111,
      ]);

      const previous = await request(server())
        .get(`/attempt/${extra.id}`)
        .set(auth(delegate))
        .expect(200);
      expect(previous.body.attempt.id).toBe(extra.id);
      expect(previous.body.previousIncidents).toHaveLength(2);
      expect(
        previous.body.previousIncidents.map((a: any) => a.status).sort(),
      ).toEqual([AttemptStatus.EXTRA_GIVEN, AttemptStatus.RESOLVED]);

      await request(server())
        .put(`/attempt/${incident.id}/replacement`)
        .set(auth(delegate))
        .send({ replacedByExtraNumber: null })
        .expect(200);
      const cleared = await db.attempt.findUnique({
        where: { id: incident.id },
      });
      expect(cleared).toMatchObject({
        status: AttemptStatus.STANDARD,
        replacedBy: null,
      });
      expect((await editLog(incident.id)).pop().comment).toBe(
        'Replacement cleared',
      );
    });

    it('returns 404 when setting a replacement on an unknown attempt', async () => {
      await request(server())
        .put(`/attempt/${NON_EXISTENT_ID}/replacement`)
        .set(auth(delegate))
        .send({ replacedByExtraNumber: 1 })
        .expect(404);
    });

    it('links an extra only to an attempt of the same competitor', async () => {
      const otherResult = await db.result.create({
        data: { personId: other.id, eventId: '333', roundId: ROUND_ID },
      });
      const otherWaiting = await db.attempt.create({
        data: {
          resultId: otherResult.id,
          attemptNumber: 1,
          value: 900,
          penalty: 0,
          status: AttemptStatus.EXTRA_GIVEN,
          type: AttemptType.STANDARD_ATTEMPT,
          solvedAt: new Date(),
        },
      });
      const extra = await createAttempt({
        attemptNumber: 4,
        value: 1222,
        type: AttemptType.EXTRA_ATTEMPT,
      });

      await request(server())
        .put(`/attempt/${extra.id}`)
        .set(auth(delegate))
        .send({
          attemptNumber: 4,
          value: 1222,
          penalty: 0,
          status: AttemptStatus.STANDARD,
          type: AttemptType.EXTRA_ATTEMPT,
          updateReplacedBy: true,
        })
        .expect(200);

      const untouched = await db.attempt.findUnique({
        where: { id: otherWaiting.id },
      });
      expect(untouched.replacedBy).toBeNull();
    });

    it('resolves an incident entered without a station', async () => {
      const incident = await createAttempt({
        attemptNumber: 5,
        status: AttemptStatus.UNRESOLVED,
      });

      await request(server())
        .put(`/attempt/${incident.id}`)
        .set(auth(delegate))
        .send({
          attemptNumber: 5,
          value: 1000,
          penalty: 0,
          status: AttemptStatus.RESOLVED,
          type: AttemptType.STANDARD_ATTEMPT,
        })
        .expect(200);
    });

    it('DELETE /attempt/:id removes an unresolved incident from a station', async () => {
      const incident = await unresolvedAttempt(6, 'E2E judge forgot');

      const res = await request(server())
        .delete(`/attempt/${incident.id}`)
        .set(auth(delegate))
        .expect(200);

      expect(res.body).toEqual({
        resultDeleted: false,
        message: 'Attempt deleted successfully',
      });
      expect(
        await db.attempt.findUnique({ where: { id: incident.id } }),
      ).toBeNull();
    });
  });

  describe('GET /attempt/round/:roundId/recent', () => {
    afterAll(clearResults);

    it('lists the latest counting solves, newest first, at most five', async () => {
      const result = await db.result.create({
        data: { personId: other.id, eventId: '333', roundId: ROUND_ID },
      });
      const base = Date.now() + 60_000;
      const make = (
        attemptNumber: number,
        offset: number,
        extra: Record<string, unknown> = {},
      ) =>
        db.attempt.create({
          data: {
            resultId: result.id,
            attemptNumber,
            value: 1000 + attemptNumber,
            penalty: 0,
            status: AttemptStatus.STANDARD,
            type: AttemptType.STANDARD_ATTEMPT,
            solvedAt: new Date(base + offset),
            ...extra,
          },
        });
      const counted = [
        await make(1, 1000),
        await make(2, 2000),
        await make(3, 3000, { status: AttemptStatus.RESOLVED }),
        await make(4, 4000),
        await make(5, 5000),
        await make(6, 500),
      ];
      // Newer, but none of these count
      await make(7, 9000, { penalty: -2 });
      await make(8, 9100, { status: AttemptStatus.UNRESOLVED });
      await make(9, 9200, { status: AttemptStatus.EXTRA_GIVEN });
      await make(10, 9300, { status: AttemptStatus.SCRAMBLED });

      const res = await request(server())
        .get(`/attempt/round/${ROUND_ID}/recent`)
        .set(auth(delegate))
        .expect(200);

      expect(res.body.map((a: any) => a.id)).toEqual(
        counted
          .slice(0, 5)
          .reverse()
          .map((a) => a.id),
      );
      expect(res.body[0].result.person).toMatchObject({
        id: other.id,
        name: other.name,
      });
    });
  });

  describe('guards', () => {
    const endpoints: [string, string, object][] = [
      ['post', '/attempt', {}],
      ['put', '/attempt/swap', {}],
      ['put', '/attempt/reorder', {}],
      ['put', `/attempt/${NON_EXISTENT_ID}/replacement`, {}],
      ['post', '/attempt/scorecard', {}],
      ['get', `/attempt/round/${ROUND_ID}/recent`, {}],
      ['get', `/attempt/${NON_EXISTENT_ID}/edit-log`, {}],
      ['get', `/attempt/${NON_EXISTENT_ID}`, {}],
      ['put', `/attempt/${NON_EXISTENT_ID}`, {}],
      ['delete', `/attempt/${NON_EXISTENT_ID}`, {}],
    ];

    it.each(endpoints)(
      '%s %s is for delegates only',
      async (method, url, body) => {
        for (const role of [
          'ORGANIZER',
          'STAGE_LEADER',
          'STAFF',
          'NO_ROLE',
        ] as const) {
          await (request(server()) as any)
            [method](url)
            .set(auth(users.tokens[role]))
            .send(body)
            .expect(403);
        }
        await (request(server()) as any)[method](url).send(body).expect(401);
      },
    );
  });
});
