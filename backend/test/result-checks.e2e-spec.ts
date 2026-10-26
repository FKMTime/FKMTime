import { INestApplication } from '@nestjs/common';
import {
  AttemptStatus,
  AttemptType,
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

const PREFIX = 'e2e-result-checks';
const REGISTRANT_IDS = [9501, 9502, 9503, 9504, 9505, 9506];
const NON_EXISTENT_ID = '00000000-0000-0000-0000-000000000000';
const DNF = -1;
const DNS = -2;

type AttemptSpec = {
  value: number;
  penalty?: number;
  status?: AttemptStatus;
  type?: AttemptType;
  inspectionTime?: number;
  replacedBy?: number;
  attemptNumber?: number;
};

describe('Result checks, double check and submission (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let users: RoleUsers;
  let delegate: string;
  let stub: ReturnType<typeof stubExternalApis>;
  let persons: Person[];

  const server = () => app.getHttpServer();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const createResult = async (
    person: Person,
    roundId: string,
    attempts: AttemptSpec[],
  ) => {
    const result = await db.result.create({
      data: {
        personId: person.id,
        eventId: roundId.split('-')[0],
        roundId,
      },
    });
    let standardNumber = 0;
    let extraNumber = 0;
    const created = [];
    for (const a of attempts) {
      const type = a.type ?? AttemptType.STANDARD_ATTEMPT;
      const attemptNumber =
        a.attemptNumber ??
        (type === AttemptType.STANDARD_ATTEMPT
          ? ++standardNumber
          : ++extraNumber);
      created.push(
        await db.attempt.create({
          data: {
            resultId: result.id,
            attemptNumber,
            value: a.value,
            penalty: a.penalty ?? 0,
            status: a.status ?? AttemptStatus.STANDARD,
            type,
            inspectionTime: a.inspectionTime,
            replacedBy: a.replacedBy,
            solvedAt: new Date(),
          },
        }),
      );
    }
    return { result, attempts: created };
  };

  const clearResults = async () => {
    await db.result.deleteMany({
      where: { personId: { in: persons.map((p) => p.id) } },
    });
    stub.reset();
  };

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    users = await createRoleUsers(app, db, PREFIX);
    delegate = users.tokens.DELEGATE;
    stub = stubExternalApis();
    persons = await createTestPersons(db, 'Checks', REGISTRANT_IDS);
  }, 30000);

  afterAll(async () => {
    try {
      stub.restore();
      await deleteTestPersons(db, { registrantIds: REGISTRANT_IDS });
      await users.cleanup();
    } finally {
      await app.close();
    }
  }, 30000);

  describe('double check (Mo3 with a one-attempt cutoff of 5:00)', () => {
    const ROUND_ID = '666-r1';
    let overCutoff: any;
    let underCutoff: any;
    let complete: any;
    let dnfSingle: any;
    let waiting: any;
    let extraPending: any;

    beforeAll(async () => {
      overCutoff = await createResult(persons[0], ROUND_ID, [{ value: 32000 }]);
      underCutoff = await createResult(persons[1], ROUND_ID, [
        { value: 15000 },
      ]);
      complete = await createResult(persons[2], ROUND_ID, [
        { value: 15000 },
        { value: 16000 },
        { value: 17000 },
      ]);
      dnfSingle = await createResult(persons[3], ROUND_ID, [
        { value: 9000, penalty: DNF },
      ]);
      // Waiting for an incident decision
      waiting = await createResult(persons[4], ROUND_ID, [
        { value: 15000 },
        { value: 16000 },
        { value: 17000, status: AttemptStatus.UNRESOLVED },
      ]);
      // Extra granted, but not done yet
      extraPending = await createResult(persons[5], ROUND_ID, [
        { value: 15000 },
        { value: 16000 },
        { value: 17000, status: AttemptStatus.EXTRA_GIVEN },
      ]);
    });

    afterAll(clearResults);

    it('lists only finished scorecards', async () => {
      const res = await request(server())
        .get(`/result/round/${ROUND_ID}/double-check`)
        .set(auth(delegate))
        .expect(200);

      const mine = res.body.results
        .map((r: any) => r.id)
        .filter((id: string) =>
          [
            overCutoff.result.id,
            underCutoff.result.id,
            complete.result.id,
            dnfSingle.result.id,
          ].includes(id),
        );
      expect(mine.sort()).toEqual(
        [overCutoff.result.id, complete.result.id, dnfSingle.result.id].sort(),
      );
      const ids = res.body.results.map((r: any) => r.id);
      expect(ids).not.toContain(underCutoff.result.id);
      expect(ids).not.toContain(waiting.result.id);
      expect(ids).not.toContain(extraPending.result.id);
      expect(res.body.totalCount).toBe(
        await db.result.count({ where: { roundId: ROUND_ID } }),
      );
    });

    it('POST /result/double-check confirms a scorecard with corrections', async () => {
      const before = await request(server())
        .get(`/result/round/${ROUND_ID}/double-check`)
        .set(auth(delegate))
        .expect(200);
      const [a1, a2, a3] = complete.attempts;

      await request(server())
        .post('/result/double-check')
        .set(auth(delegate))
        .send({
          resultId: complete.result.id,
          attempts: [
            { id: a1.id, attemptNumber: 1, value: 15000, penalty: 0 },
            { id: a2.id, attemptNumber: 2, value: 16100, penalty: 2 },
            { id: a3.id, attemptNumber: 3, value: 17000, penalty: 0 },
          ].map((a) => ({
            ...a,
            status: AttemptStatus.STANDARD,
            type: AttemptType.STANDARD_ATTEMPT,
          })),
        })
        .expect(200);

      const result = await db.result.findUnique({
        where: { id: complete.result.id },
      });
      expect(result.isDoubleChecked).toBe(true);
      expect(result.doubleCheckedById).toBe(users.userIds.DELEGATE);
      expect(result.doubleCheckedAt).not.toBeNull();
      const corrected = await db.attempt.findUnique({ where: { id: a2.id } });
      expect(corrected).toMatchObject({ value: 16100, penalty: 2 });
      const log = await db.attemptEditLog.findMany({
        where: { attemptId: a2.id },
      });
      expect(log).toHaveLength(1);
      expect(log[0]).toMatchObject({
        comment: 'Double checked',
        value: 16100,
        penalty: 2,
        editedById: users.userIds.DELEGATE,
      });
      expect(stub.lastAttemptsFor(persons[2].registrantId, ROUND_ID)).toEqual([
        15000, 16300, 17000,
      ]);

      const after = await request(server())
        .get(`/result/round/${ROUND_ID}/double-check`)
        .set(auth(delegate))
        .expect(200);
      expect(after.body.results.map((r: any) => r.id)).not.toContain(
        complete.result.id,
      );
      expect(after.body.doubleCheckedCount).toBe(
        before.body.doubleCheckedCount + 1,
      );
      expect(
        after.body.checkedResults.find((r: any) => r.id === complete.result.id),
      ).toMatchObject({ person: { id: persons[2].id } });

      const details = await request(server())
        .get(`/result/${complete.result.id}`)
        .set(auth(delegate))
        .expect(200);
      expect(details.body.doubleCheckedBy).toEqual({
        id: users.userIds.DELEGATE,
        fullName: 'E2E DELEGATE',
        avatarUrl: null,
      });
    });

    it('DELETE /result/round/:roundId/double-check resets the whole round', async () => {
      await db.result.update({
        where: { id: overCutoff.result.id },
        data: { isDoubleChecked: true },
      });

      await request(server())
        .delete(`/result/round/${ROUND_ID}/double-check`)
        .set(auth(delegate))
        .expect(204);

      expect(
        await db.result.count({
          where: { roundId: ROUND_ID, isDoubleChecked: true },
        }),
      ).toBe(0);
    });
  });

  describe('GET /result/round/:roundId/missing-persons', () => {
    let wcif: any;
    let seedPerson: Person;

    beforeAll(async () => {
      wcif = (await db.competition.findFirst()).wcif;
    });

    afterEach(async () => {
      if (seedPerson) {
        await db.result.deleteMany({
          where: { personId: seedPerson.id, roundId: '666-r1' },
        });
      }
    });

    it('lists registered competitors without a result in a first round', async () => {
      const registered = wcif.persons
        .filter((p: any) => p.registration?.eventIds.includes('666'))
        .map((p: any) => p.registrantId);
      seedPerson = await db.person.findFirst({
        where: { registrantId: registered[0] },
      });
      const before = await request(server())
        .get('/result/round/666-r1/missing-persons')
        .set(auth(delegate))
        .expect(200);
      const beforeIds = before.body.map((p: any) => p.registrantId);
      expect(beforeIds).toContain(seedPerson.registrantId);
      beforeIds.forEach((id: number) => expect(registered).toContain(id));

      await db.result.create({
        data: { personId: seedPerson.id, eventId: '666', roundId: '666-r1' },
      });

      const after = await request(server())
        .get('/result/round/666-r1/missing-persons')
        .set(auth(delegate))
        .expect(200);
      expect(after.body.map((p: any) => p.registrantId)).not.toContain(
        seedPerson.registrantId,
      );
      expect(after.body).toHaveLength(before.body.length - 1);
    });

    it('uses competitor assignments for later rounds', async () => {
      const groupIds = new Set<number>();
      for (const venue of wcif.schedule.venues)
        for (const room of venue.rooms)
          for (const activity of room.activities)
            if (activity.activityCode === '333-r2')
              activity.childActivities.forEach((c: any) => groupIds.add(c.id));
      const assigned = wcif.persons
        .filter((p: any) =>
          p.assignments.some(
            (a: any) =>
              a.assignmentCode === 'competitor' && groupIds.has(a.activityId),
          ),
        )
        .map((p: any) => p.registrantId)
        .sort((a: number, b: number) => a - b);
      expect(assigned.length).toBeGreaterThan(0);
      const withResults = (
        await db.result.findMany({
          where: { roundId: '333-r2' },
          include: { person: true },
        })
      ).map((r) => r.person.registrantId);

      const res = await request(server())
        .get('/result/round/333-r2/missing-persons')
        .set(auth(delegate))
        .expect(200);

      expect(
        res.body
          .map((p: any) => p.registrantId)
          .sort((a: number, b: number) => a - b),
      ).toEqual(assigned.filter((id: number) => !withResults.includes(id)));
    });
  });

  describe('GET /result/checks', () => {
    afterAll(clearResults);

    it('flags inspection, penalties, DNS and suspiciously fast solves', async () => {
      const flagged = await createResult(persons[0], 'clock-r1', [
        { value: 1000, inspectionTime: 16000 },
        { value: 1000, penalty: 4 },
        { value: 0, penalty: DNS },
        { value: 1000 },
        { value: 1000, inspectionTime: 15000 },
      ]);
      const fast = await createResult(persons[1], 'clock-r1', [
        { value: 3000 },
        { value: 3000 },
        { value: 3000 },
        { value: 1000 },
      ]);

      const res = await request(server())
        .get('/result/checks?roundId=clock-r1')
        .set(auth(delegate))
        .expect(200);

      const byId = new Map(res.body.map((a: any) => [a.id, a]));
      const [inspection, penalty, dns, ok, borderline] = flagged.attempts;
      expect(byId.has(inspection.id)).toBe(true);
      expect(byId.has(penalty.id)).toBe(true);
      expect(byId.has(dns.id)).toBe(true);
      expect(byId.has(ok.id)).toBe(false);
      expect(byId.has(borderline.id)).toBe(false);
      fast.attempts
        .slice(0, 3)
        .forEach((a: any) => expect(byId.has(a.id)).toBe(false));
      const fastAttempt: any = byId.get(fast.attempts[3].id);
      expect(fastAttempt.fastAttemptRatio).toBeCloseTo(1 / 3);
      expect(fastAttempt.result.person.id).toBe(persons[1].id);
    });

    it('does not flag DNS in a round with a cumulative time limit', async () => {
      const bld = await createResult(persons[2], '333bf-r1', [
        { value: 50000 },
        { value: 0, penalty: DNS },
      ]);

      const res = await request(server())
        .get('/result/checks?roundId=333bf-r1')
        .set(auth(delegate))
        .expect(200);

      expect(res.body.map((a: any) => a.id)).not.toContain(bld.attempts[1].id);
    });
  });

  describe('GET /result/:id', () => {
    afterAll(clearResults);

    it('reports the used and remaining cumulative time limit', async () => {
      const bld = await createResult(persons[0], '333bf-r1', [
        { value: 20000 },
        { value: 15000, penalty: DNF },
      ]);

      const res = await request(server())
        .get(`/result/${bld.result.id}`)
        .set(auth(delegate))
        .expect(200);

      // A DNF still uses the time it took
      expect(res.body.remainingAndUsedCumulativeLimit).toEqual({
        used: 35000,
        remaining: 25000,
      });
      expect(res.body.person.id).toBe(persons[0].id);
      expect(res.body.attempts).toHaveLength(2);
      res.body.attempts.forEach((a: any) =>
        expect(a.staffingWarnings).toEqual([]),
      );
    });

    it('does not count a DNS towards the cumulative time limit', async () => {
      const bld = await createResult(persons[1], '333bf-r1', [
        { value: 20000 },
        { value: 0, penalty: DNS },
      ]);

      const res = await request(server())
        .get(`/result/${bld.result.id}`)
        .set(auth(delegate))
        .expect(200);

      expect(res.body.remainingAndUsedCumulativeLimit).toEqual({
        used: 20000,
        remaining: 40000,
      });
    });

    it('has no cumulative limit for a normal round', async () => {
      const normal = await createResult(persons[2], '333-r1', [
        { value: 1000 },
      ]);

      const res = await request(server())
        .get(`/result/${normal.result.id}`)
        .set(auth(delegate))
        .expect(200);

      expect(res.body.remainingAndUsedCumulativeLimit).toEqual({
        used: null,
        remaining: null,
      });
    });

    it('returns 404 for an unknown result', async () => {
      await request(server())
        .get(`/result/${NON_EXISTENT_ID}`)
        .set(auth(delegate))
        .expect(404);
    });
  });

  describe('POST /result/:id/assign-dns', () => {
    afterAll(clearResults);

    it('fills the remaining attempts with DNS', async () => {
      const bld = await createResult(persons[0], '333bf-r1', [
        { value: 30000 },
      ]);

      const res = await request(server())
        .post(`/result/${bld.result.id}/assign-dns`)
        .set(auth(users.tokens.ORGANIZER))
        .expect(200);

      expect(res.body).toEqual({
        message: 'DNS added',
        status: 200,
        error: false,
      });
      const attempts = await db.attempt.findMany({
        where: { resultId: bld.result.id },
        orderBy: { attemptNumber: 'asc' },
        include: { editLogs: true },
      });
      expect(
        attempts.map((a) => [a.attemptNumber, a.penalty, a.value]),
      ).toEqual([
        [1, 0, 30000],
        [2, DNS, 0],
        [3, DNS, 0],
        [4, DNS, 0],
        [5, DNS, 0],
      ]);
      expect(attempts[1].editLogs).toEqual([
        expect.objectContaining({
          comment: 'DNS auto-assigned',
          editedById: null,
          penalty: DNS,
        }),
      ]);

      const again = await request(server())
        .post(`/result/${bld.result.id}/assign-dns`)
        .set(auth(delegate))
        .expect(400);
      expect(again.body.message).toBe('No attempts left');
      expect(
        await db.attempt.count({ where: { resultId: bld.result.id } }),
      ).toBe(5);
    });

    it('refuses to make a result with no attempts all DNS', async () => {
      const empty = await createResult(persons[1], '333bf-r1', []);

      const res = await request(server())
        .post(`/result/${empty.result.id}/assign-dns`)
        .set(auth(delegate))
        .expect(400);

      expect(res.body.message).toBe(
        'Cannot assign DNS to every attempt, delete the result instead',
      );
      expect(
        await db.attempt.count({ where: { resultId: empty.result.id } }),
      ).toBe(0);
    });

    it('refuses to make a result with only DNS attempts all DNS', async () => {
      const onlyDns = await createResult(persons[2], '333bf-r1', [
        { value: 0, penalty: DNS },
      ]);

      await request(server())
        .post(`/result/${onlyDns.result.id}/assign-dns`)
        .set(auth(delegate))
        .expect(400);

      expect(
        await db.attempt.count({ where: { resultId: onlyDns.result.id } }),
      ).toBe(1);
    });

    it('is not available to stage leaders', async () => {
      await request(server())
        .post(`/result/${NON_EXISTENT_ID}/assign-dns`)
        .set(auth(users.tokens.STAGE_LEADER))
        .expect(403);
    });
  });

  describe('DELETE /result/:id', () => {
    afterAll(clearResults);

    it('removes the result and updates the competitor attendance', async () => {
      const assigned = await createResult(persons[0], '333-r1', [
        { value: 1000 },
      ]);
      const walkIn = await createResult(persons[1], '333-r1', [
        { value: 1000 },
      ]);
      const assignedActivity = await db.staffActivity.create({
        data: {
          personId: persons[0].id,
          groupId: '333-r1-g3',
          role: StaffRole.COMPETITOR,
          isAssigned: true,
          status: StaffActivityStatus.PRESENT,
        },
      });
      const walkInActivity = await db.staffActivity.create({
        data: {
          personId: persons[1].id,
          groupId: '333-r1-g1',
          role: StaffRole.COMPETITOR,
          isAssigned: false,
          status: StaffActivityStatus.PRESENT,
        },
      });
      const judging = await db.staffActivity.create({
        data: {
          personId: persons[0].id,
          groupId: '333-r1-g4',
          role: StaffRole.JUDGE,
          isAssigned: true,
          status: StaffActivityStatus.PRESENT,
        },
      });

      for (const id of [assigned.result.id, walkIn.result.id]) {
        await request(server())
          .delete(`/result/${id}`)
          .set(auth(delegate))
          .expect(204);
        expect(await db.result.findUnique({ where: { id } })).toBeNull();
      }
      expect(
        await db.attempt.count({
          where: { id: { in: assigned.attempts.map((a) => a.id) } },
        }),
      ).toBe(0);

      const after = await db.staffActivity.findUnique({
        where: { id: assignedActivity.id },
      });
      expect(after.status).toBe(StaffActivityStatus.ABSENT);
      expect(
        await db.staffActivity.findUnique({ where: { id: walkInActivity.id } }),
      ).toBeNull();
      // Staffing is not touched
      expect(
        (await db.staffActivity.findUnique({ where: { id: judging.id } }))
          .status,
      ).toBe(StaffActivityStatus.PRESENT);
    });

    it('returns 404 for an unknown result', async () => {
      await request(server())
        .delete(`/result/${NON_EXISTENT_ID}`)
        .set(auth(delegate))
        .expect(404);
    });
  });

  describe('submitting to WCA Live', () => {
    const ROUND_ID = '222-r1';

    afterAll(clearResults);

    it('GET /result/:id/enter submits one scorecard with counting attempts', async () => {
      const r = await createResult(persons[0], ROUND_ID, [
        { value: 500 },
        { value: 600, penalty: 2 },
        { value: 700, status: AttemptStatus.EXTRA_GIVEN, replacedBy: 1 },
        { value: 800, penalty: DNF },
        { value: 0, penalty: DNS },
        { value: 650, type: AttemptType.EXTRA_ATTEMPT },
      ]);
      stub.reset();

      const res = await request(server())
        .get(`/result/${r.result.id}/enter`)
        .set(auth(delegate))
        .expect(200);

      expect(res.body).toEqual({ message: 'Scorecard submitted' });
      expect(stub.submissions).toHaveLength(1);
      expect(stub.submissions[0]).toEqual({
        competitionWcaId: (await db.competition.findFirst()).wcaId,
        eventId: '222',
        roundNumber: 1,
        results: [
          {
            registrantId: persons[0].registrantId,
            wcaId: null,
            attempts: [
              { result: 500 },
              { result: 800 },
              { result: 650 },
              { result: DNF },
              { result: DNS },
            ],
          },
        ],
      });
    });

    it('POST /result/round/:roundId/enter resubmits the whole round', async () => {
      await createResult(persons[1], ROUND_ID, [
        { value: 900 },
        { value: 950 },
      ]);
      stub.reset();

      const res = await request(server())
        .post(`/result/round/${ROUND_ID}/enter`)
        .set(auth(delegate))
        .expect(200);

      expect(res.body).toEqual({ message: 'Round resubmitted' });
      expect(stub.submissions).toHaveLength(1);
      const submitted = stub.submissions[0];
      expect(submitted).toMatchObject({ eventId: '222', roundNumber: 1 });
      expect(
        submitted.results.find(
          (r) => r.registrantId === persons[1].registrantId,
        ).attempts,
      ).toEqual([{ result: 900 }, { result: 950 }]);
      expect(
        submitted.results.find(
          (r) => r.registrantId === persons[0].registrantId,
        ),
      ).toBeDefined();
      expect(submitted.results).toHaveLength(
        await db.result.count({ where: { roundId: ROUND_ID } }),
      );
    });

    it('reports a WCA Live failure', async () => {
      stub.setWcaLiveStatus(500);
      try {
        const res = await request(server())
          .post(`/result/round/${ROUND_ID}/enter`)
          .set(auth(delegate))
          .expect(500);
        expect(res.body.message).toBe('WCA Live error');
      } finally {
        stub.setWcaLiveStatus(200);
      }
    });

    it('needs a Cubing Contests token for an unofficial event', async () => {
      const competition = await db.competition.findFirst();
      await db.competition.update({
        where: { id: competition.id },
        data: { cubingContestsToken: null },
      });
      try {
        const res = await request(server())
          .post('/result/round/mirror-r1/enter')
          .set(auth(delegate))
          .expect(404);
        expect(res.body.message).toBe('Cubing Contests token not found');
      } finally {
        await db.competition.update({
          where: { id: competition.id },
          data: { cubingContestsToken: competition.cubingContestsToken },
        });
      }
    });
  });

  describe('GET /result/public/round/:roundId', () => {
    const ROUND_ID = '333-r1';
    afterAll(clearResults);

    it('is readable without logging in and supports search', async () => {
      const mine = await createResult(persons[3], ROUND_ID, [{ value: 1234 }]);

      const all = await request(server())
        .get(`/result/public/round/${ROUND_ID}`)
        .expect(200);
      const entry = all.body.find((r: any) => r.id === mine.result.id);
      expect(entry.person).toEqual({
        id: persons[3].id,
        name: persons[3].name,
        wcaId: null,
        registrantId: persons[3].registrantId,
        countryIso2: 'XA',
        canCompete: true,
      });
      expect(entry.attempts.map((a: any) => a.value)).toEqual([1234]);

      const byRegistrant = await request(server())
        .get(
          `/result/public/round/${ROUND_ID}?search=${persons[3].registrantId}`,
        )
        .expect(200);
      expect(byRegistrant.body.map((r: any) => r.id)).toEqual([mine.result.id]);

      const byName = await request(server())
        .get(
          `/result/public/round/${ROUND_ID}?search=${encodeURIComponent(
            'checks competitor 9504',
          )}`,
        )
        .expect(200);
      expect(byName.body.map((r: any) => r.id)).toEqual([mine.result.id]);
    });
  });

  describe('guards', () => {
    const delegateOnly: [string, string][] = [
      ['get', '/result/round/333-r1/double-check'],
      ['get', '/result/round/333-r1/missing-persons'],
      ['post', '/result/double-check'],
      ['delete', '/result/round/333-r1/double-check'],
      ['get', '/result/checks'],
      ['get', `/result/${NON_EXISTENT_ID}`],
      ['delete', `/result/${NON_EXISTENT_ID}`],
      ['post', '/result/round/333-r1/enter'],
      ['get', `/result/${NON_EXISTENT_ID}/enter`],
      ['delete', '/result/group/333-r1-g1/restart'],
    ];

    it.each(delegateOnly)(
      '%s %s is for delegates only',
      async (method, url) => {
        for (const role of [
          'ORGANIZER',
          'STAGE_LEADER',
          'STAFF',
          'NO_ROLE',
        ] as const) {
          await (request(server()) as any)
            [method](url)
            .set(auth(users.tokens[role]))
            .send({})
            .expect(403);
        }
        await (request(server()) as any)[method](url).send({}).expect(401);
      },
    );

    it('POST /result/:id/assign-dns is for organizers and delegates', async () => {
      for (const role of ['STAGE_LEADER', 'STAFF', 'NO_ROLE'] as const) {
        await request(server())
          .post(`/result/${NON_EXISTENT_ID}/assign-dns`)
          .set(auth(users.tokens[role]))
          .expect(403);
      }
      await request(server())
        .post(`/result/${NON_EXISTENT_ID}/assign-dns`)
        .expect(401);
    });

    it('result lists only need a login', async () => {
      for (const url of [
        '/result/round/333-r1',
        `/result/person/${persons[0].id}`,
      ]) {
        await request(server())
          .get(url)
          .set(auth(users.tokens.STAFF))
          .expect(200);
        await request(server()).get(url).expect(401);
      }
    });
  });
});
