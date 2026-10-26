import { INestApplication } from '@nestjs/common';
import { Person, StaffRole } from '@prisma/client';
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

const PREFIX = 'e2e-checkin';
const REGISTRANT_IDS = [9201, 9202, 9203];
const CARD_A = 'E2E-CHECKIN-CARD-A';
const CARD_B = 'E2E-CHECKIN-CARD-B';
const CARD_C = 'E2E-CHECKIN-CARD-C';
const NON_EXISTENT_ID = '00000000-0000-0000-0000-000000000000';

describe('Person check-in and card assignment (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let adminToken: string;
  let users: RoleUsers;
  let persons: Person[];

  beforeAll(async () => {
    ({ app, db, adminToken } = await createTestApp());
    users = await createRoleUsers(app, db, PREFIX);
    persons = await createTestPersons(db, 'Checkin', REGISTRANT_IDS);
  }, 30000);

  afterAll(async () => {
    try {
      await deleteTestPersons(db, { registrantIds: REGISTRANT_IDS });
      await db.person.deleteMany({
        where: { name: { startsWith: 'E2E Added Person' } },
      });
      await users.cleanup();
    } finally {
      await app.close();
    }
  }, 30000);

  const server = () => app.getHttpServer();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  describe('GET /person filters', () => {
    it('paginates in registrant id order with a stable total count', async () => {
      const page1 = await request(server())
        .get('/person?page=1&pageSize=3')
        .set(auth(adminToken))
        .expect(200);
      const page2 = await request(server())
        .get('/person?page=2&pageSize=3')
        .set(auth(adminToken))
        .expect(200);

      expect(page1.body.data).toHaveLength(3);
      expect(page2.body.count).toBe(page1.body.count);
      const total = await db.person.count();
      expect(page1.body.count).toBe(total);
      const ids1 = page1.body.data.map((p: any) => p.id);
      page2.body.data.forEach((p: any) => expect(ids1).not.toContain(p.id));
      const regIds = [...page1.body.data, ...page2.body.data]
        .map((p: any) => p.registrantId)
        .filter((r: number | null) => r !== null);
      expect(regIds).toEqual([...regIds].sort((a, b) => a - b));
    });

    it('finds a person by name search (case-insensitive)', async () => {
      const res = await request(server())
        .get('/person?search=checkin competitor 9202')
        .set(auth(adminToken))
        .expect(200);

      expect(res.body.count).toBe(1);
      expect(res.body.data[0].id).toBe(persons[1].id);
    });

    it('filters by registrant id', async () => {
      const res = await request(server())
        .get(`/person?registrantId=${REGISTRANT_IDS[2]}`)
        .set(auth(adminToken))
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(persons[2].id);
    });

    it('filters by card id', async () => {
      await db.person.update({
        where: { id: persons[0].id },
        data: { cardId: CARD_A },
      });
      try {
        const res = await request(server())
          .get(`/person?cardId=${CARD_A}`)
          .set(auth(adminToken))
          .expect(200);

        expect(res.body.data.map((p: any) => p.id)).toEqual([persons[0].id]);
      } finally {
        await db.person.update({
          where: { id: persons[0].id },
          data: { cardId: null },
        });
      }
    });

    it('combines search with withoutCardAssigned', async () => {
      await db.person.update({
        where: { id: persons[0].id },
        data: { cardId: CARD_A },
      });
      try {
        const res = await request(server())
          .get('/person?search=Checkin Competitor&withoutCardAssigned=true')
          .set(auth(adminToken))
          .expect(200);

        const ids = res.body.data.map((p: any) => p.id);
        expect(ids).not.toContain(persons[0].id);
        expect(ids).toEqual(
          expect.arrayContaining([persons[1].id, persons[2].id]),
        );
      } finally {
        await db.person.update({
          where: { id: persons[0].id },
          data: { cardId: null },
        });
      }
    });

    it('lists only newcomers (no WCA id, can compete)', async () => {
      const res = await request(server())
        .get('/person?onlyNewcomers=true&pageSize=1000')
        .set(auth(adminToken))
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      res.body.data.forEach((p: any) => {
        expect(p.wcaId).toBeNull();
        expect(p.canCompete).toBe(true);
      });
      expect(res.body.data.map((p: any) => p.id)).toEqual(
        expect.arrayContaining(persons.map((p) => p.id)),
      );
    });

    it('lists only persons who have not checked in', async () => {
      await db.person.update({
        where: { id: persons[0].id },
        data: { checkedInAt: new Date() },
      });
      try {
        const res = await request(server())
          .get('/person?onlyNotCheckedIn=true&pageSize=1000')
          .set(auth(adminToken))
          .expect(200);

        const ids = res.body.data.map((p: any) => p.id);
        expect(ids).not.toContain(persons[0].id);
        expect(ids).toContain(persons[1].id);
        res.body.data.forEach((p: any) => expect(p.checkedInAt).toBeNull());
      } finally {
        await db.person.update({
          where: { id: persons[0].id },
          data: { checkedInAt: null },
        });
      }
    });
  });

  describe('POST /person', () => {
    it('lets an organizer add a person', async () => {
      const res = await request(server())
        .post('/person')
        .set(auth(users.tokens.ORGANIZER))
        .send({
          name: 'E2E Added Person One',
          gender: 'f',
          countryIso2: 'XA',
          canCompete: true,
        })
        .expect(201);

      expect(res.body).toMatchObject({
        name: 'E2E Added Person One',
        countryIso2: 'XA',
        canCompete: true,
        cardId: null,
        registrantId: null,
      });
      const inDb = await db.person.findUnique({ where: { id: res.body.id } });
      expect(inDb).not.toBeNull();
    });

    it('stores a card id given on creation', async () => {
      const res = await request(server())
        .post('/person')
        .set(auth(users.tokens.DELEGATE))
        .send({
          name: 'E2E Added Person Staff',
          gender: 'm',
          canCompete: false,
          cardId: CARD_C,
        })
        .expect(201);

      expect(res.body.cardId).toBe(CARD_C);
      expect(res.body.canCompete).toBe(false);
    });

    it('requires a country for a competing person', async () => {
      const res = await request(server())
        .post('/person')
        .set(auth(adminToken))
        .send({
          name: 'E2E Added Person NoCountry',
          gender: 'm',
          canCompete: true,
        })
        .expect(400);

      expect(res.body.message).toBe('Country is required');
      expect(
        await db.person.count({
          where: { name: 'E2E Added Person NoCountry' },
        }),
      ).toBe(0);
    });

    it('validates the body', async () => {
      await request(server())
        .post('/person')
        .set(auth(adminToken))
        .send({ gender: 'm', canCompete: 'yes' })
        .expect(400);
    });

    it.each(['STAFF', 'STAGE_LEADER', 'NO_ROLE'] as const)(
      'returns 403 for %s',
      async (role) => {
        await request(server())
          .post('/person')
          .set(auth(users.tokens[role]))
          .send({
            name: 'E2E Added Person Forbidden',
            gender: 'm',
            canCompete: false,
          })
          .expect(403);
      },
    );

    it('returns 401 when not authenticated', async () => {
      await request(server())
        .post('/person')
        .send({ name: 'E2E Added Person Anon', gender: 'm', canCompete: false })
        .expect(401);
    });
  });

  describe('GET /person/all and /person/without-card', () => {
    it('returns only persons without a card when asked', async () => {
      await db.person.update({
        where: { id: persons[0].id },
        data: { cardId: CARD_A },
      });
      try {
        const res = await request(server())
          .get('/person/all?withoutCardAssigned=true')
          .set(auth(adminToken))
          .expect(200);

        const ids = res.body.map((p: any) => p.id);
        expect(ids).not.toContain(persons[0].id);
        expect(ids).toContain(persons[1].id);
        res.body.forEach((p: any) =>
          expect([null, '', '0']).toContain(p.cardId),
        );
      } finally {
        await db.person.update({
          where: { id: persons[0].id },
          data: { cardId: null },
        });
      }
    });

    it('counts persons without a card and updates when a card is assigned', async () => {
      const before = await request(server())
        .get('/person/without-card')
        .set(auth(adminToken))
        .expect(200);

      await request(server())
        .put(`/person/${persons[1].id}`)
        .set(auth(adminToken))
        .send({ cardId: CARD_A })
        .expect(200);

      const after = await request(server())
        .get('/person/without-card')
        .set(auth(adminToken))
        .expect(200);
      expect(after.body.count).toBe(before.body.count - 1);

      await request(server())
        .put(`/person/${persons[1].id}`)
        .set(auth(adminToken))
        .send({ cardId: '' })
        .expect(200);
      const unassigned = await db.person.findUnique({
        where: { id: persons[1].id },
      });
      expect(unassigned.cardId).toBeNull();
    });

    it('returns 401 when not authenticated', async () => {
      await request(server()).get('/person/without-card').expect(401);
    });
  });

  describe('PUT /person/:id (card assignment)', () => {
    afterEach(async () => {
      await db.person.updateMany({
        where: { id: { in: persons.map((p) => p.id) } },
        data: { cardId: null },
      });
    });

    it('assigns a card', async () => {
      const res = await request(server())
        .put(`/person/${persons[0].id}`)
        .set(auth(users.tokens.STAFF))
        .send({ cardId: CARD_A })
        .expect(200);

      expect(res.body).toEqual({ message: 'Person updated' });
      const updated = await db.person.findUnique({
        where: { id: persons[0].id },
      });
      expect(updated.cardId).toBe(CARD_A);
    });

    it('rejects a card already assigned to someone else', async () => {
      await db.person.update({
        where: { id: persons[0].id },
        data: { cardId: CARD_A },
      });

      const res = await request(server())
        .put(`/person/${persons[1].id}`)
        .set(auth(adminToken))
        .send({ cardId: CARD_A })
        .expect(409);

      expect(res.body.message).toBe(
        'This card is already assigned to someone else',
      );
      const other = await db.person.findUnique({
        where: { id: persons[1].id },
      });
      expect(other.cardId).toBeNull();
    });

    it('returns 400 when cardId is missing', async () => {
      await request(server())
        .put(`/person/${persons[0].id}`)
        .set(auth(adminToken))
        .send({})
        .expect(400);
    });

    it('returns 404 for an unknown person', async () => {
      await request(server())
        .put(`/person/${NON_EXISTENT_ID}`)
        .set(auth(adminToken))
        .send({ cardId: 'E2E-CHECKIN-UNKNOWN' })
        .expect(404);
    });
  });

  describe('GET /person/card/:cardId/sensitive', () => {
    it('returns sensitive data for the card holder', async () => {
      const birthdate = new Date('2001-02-03T00:00:00.000Z');
      await db.person.update({
        where: { id: persons[2].id },
        data: { cardId: CARD_B, birthdate },
      });
      try {
        const res = await request(server())
          .get(`/person/card/${CARD_B}/sensitive`)
          .set(auth(users.tokens.STAFF))
          .expect(200);

        expect(res.body).toEqual({
          id: persons[2].id,
          registrantId: REGISTRANT_IDS[2],
          wcaId: null,
          canCompete: true,
          cardId: CARD_B,
          name: persons[2].name,
          countryIso2: 'XA',
          birthdate: birthdate.toISOString(),
          checkedInAt: null,
        });
      } finally {
        await db.person.update({
          where: { id: persons[2].id },
          data: { cardId: null, birthdate: null },
        });
      }
    });

    it('returns 404 for an unknown card', async () => {
      const res = await request(server())
        .get('/person/card/E2E-NO-SUCH-CARD/sensitive')
        .set(auth(adminToken))
        .expect(404);

      expect(res.body).toEqual({
        message: 'Competitor not found',
        shouldResetTime: false,
      });
    });

    it('returns 401 when not authenticated', async () => {
      await request(server())
        .get(`/person/card/${CARD_B}/sensitive`)
        .expect(401);
    });
  });

  describe('check-in', () => {
    afterEach(async () => {
      await db.person.updateMany({
        where: { id: { in: persons.map((p) => p.id) } },
        data: { cardId: null, checkedInAt: null },
      });
    });

    it('checks in with a card and updates the counters', async () => {
      const before = await request(server())
        .get('/person/check-in')
        .set(auth(adminToken))
        .expect(200);
      expect(
        before.body.personsWhoDidNotCheckIn.map((p: any) => p.id),
      ).toContain(persons[0].id);

      const res = await request(server())
        .post(`/person/check-in/${persons[0].id}`)
        .set(auth(users.tokens.STAFF))
        .send({ cardId: CARD_A })
        .expect(200);

      expect(res.body).toMatchObject({
        message: 'Checked in successfully',
        checkedInPersonsCount: before.body.checkedInPersonsCount + 1,
        totalPersonsCount: before.body.totalPersonsCount,
      });
      const updated = await db.person.findUnique({
        where: { id: persons[0].id },
      });
      expect(updated.cardId).toBe(CARD_A);
      expect(updated.checkedInAt).not.toBeNull();

      const after = await request(server())
        .get('/person/check-in')
        .set(auth(adminToken))
        .expect(200);
      expect(after.body.checkedInPersonsCount).toBe(
        before.body.checkedInPersonsCount + 1,
      );
      expect(
        after.body.personsWhoDidNotCheckIn.map((p: any) => p.id),
      ).not.toContain(persons[0].id);
    });

    it('refuses a check-in with a card that belongs to someone else', async () => {
      await db.person.update({
        where: { id: persons[0].id },
        data: { cardId: CARD_A },
      });

      const res = await request(server())
        .post(`/person/check-in/${persons[1].id}`)
        .set(auth(adminToken))
        .send({ cardId: CARD_A })
        .expect(409);

      expect(res.body.message).toBe('Card already assigned');
      const second = await db.person.findUnique({
        where: { id: persons[1].id },
      });
      expect(second.checkedInAt).toBeNull();
      expect(second.cardId).toBeNull();
    });

    it('undoes a check-in but keeps the card by default', async () => {
      await request(server())
        .post(`/person/check-in/${persons[1].id}`)
        .set(auth(adminToken))
        .send({ cardId: CARD_B })
        .expect(200);

      await request(server())
        .delete(`/person/check-in/${persons[1].id}`)
        .set(auth(adminToken))
        .expect(204);

      const updated = await db.person.findUnique({
        where: { id: persons[1].id },
      });
      expect(updated.checkedInAt).toBeNull();
      expect(updated.cardId).toBe(CARD_B);
    });

    it('undoes a check-in and removes the card when asked', async () => {
      await request(server())
        .post(`/person/check-in/${persons[1].id}`)
        .set(auth(adminToken))
        .send({ cardId: CARD_B })
        .expect(200);

      await request(server())
        .delete(`/person/check-in/${persons[1].id}?removeCard=true`)
        .set(auth(adminToken))
        .expect(204);

      const updated = await db.person.findUnique({
        where: { id: persons[1].id },
      });
      expect(updated.checkedInAt).toBeNull();
      expect(updated.cardId).toBeNull();
    });

    it('returns 404 when checking in an unknown person', async () => {
      await request(server())
        .post(`/person/check-in/${NON_EXISTENT_ID}`)
        .set(auth(adminToken))
        .send({ cardId: 'E2E-CHECKIN-GHOST' })
        .expect(404);
    });

    it('returns 401 when not authenticated', async () => {
      await request(server())
        .delete(`/person/check-in/${persons[0].id}`)
        .expect(401);
      await request(server()).get('/person/check-in').expect(401);
    });
  });

  describe('POST /person/change-group', () => {
    const ROUND_ID = '333-r1';
    const FROM_GROUP = '333-r1-g1';
    const TO_GROUP = '333-r1-g2';
    // The WCA holds the WCIF of the competition FKMTime runs: the seeded one
    let wcif: {
      id: string;
      schedule: {
        venues: {
          rooms: {
            activities: {
              childActivities: { id: number; activityCode: string }[];
            }[];
          }[];
        }[];
      };
    };
    let fromActivityId: number;
    let toActivityId: number;
    let movedPerson: Person;
    let activityId: string;
    let patchStatus = 200;
    let stub: ReturnType<typeof stubExternalApis>;

    beforeAll(async () => {
      wcif = (await db.competition.findFirst()).wcif as unknown as typeof wcif;
      const groupActivityId = (groupId: string) =>
        wcif.schedule.venues
          .flatMap((v) => v.rooms)
          .flatMap((r) => r.activities)
          .flatMap((a) => a.childActivities)
          .find((g) => g.activityCode === groupId).id;
      fromActivityId = groupActivityId(FROM_GROUP);
      toActivityId = groupActivityId(TO_GROUP);
      const candidates = await db.staffActivity.findMany({
        where: { groupId: FROM_GROUP, role: StaffRole.COMPETITOR },
        include: { person: { include: { StaffActivity: true } } },
        orderBy: { person: { registrantId: 'desc' } },
      });
      const chosen = candidates.find(
        (c) =>
          !REGISTRANT_IDS.includes(c.person.registrantId) &&
          !c.person.StaffActivity.some((a) => a.groupId === TO_GROUP),
      );
      movedPerson = chosen.person;
      activityId = chosen.id;

      await db.user.update({
        where: { id: users.userIds.ORGANIZER },
        data: { wcaUserId: 990001, wcaAccessToken: 'e2e-fake-wca-token' },
      });
      stub = stubExternalApis([
        {
          match: (url) => url.includes('/wcif/version/2'),
          respond: () => ({ status: 200, body: wcif }),
        },
        {
          match: (url, init) =>
            init?.method === 'PATCH' && url.endsWith('/wcif'),
          respond: () =>
            patchStatus === 200
              ? { status: 200, body: {} }
              : { status: patchStatus, body: { error: 'E2E rejected' } },
        },
      ]);
    });

    afterAll(async () => {
      stub.restore();
      await db.staffActivity.update({
        where: { id: activityId },
        data: { groupId: FROM_GROUP },
      });
    });

    it('moves a competitor to another group and patches the WCIF', async () => {
      const res = await request(server())
        .post('/person/change-group')
        .set(auth(users.tokens.ORGANIZER))
        .send({ personId: movedPerson.id, newGroupId: TO_GROUP })
        .expect(200);

      expect(res.body).toEqual({
        message: 'Successfully moved the competitor to another group',
      });
      const activity = await db.staffActivity.findUnique({
        where: { id: activityId },
      });
      expect(activity.groupId).toBe(TO_GROUP);

      const patch = stub.calls.find((c) => c.method === 'PATCH');
      expect(patch.url).toContain(`/competitions/${wcif.id}/wcif`);
      const patchedPerson = patch.body.persons.find(
        (p: any) => p.registrantId === movedPerson.registrantId,
      );
      const activityIds = patchedPerson.assignments.map(
        (a: any) => a.activityId,
      );
      expect(activityIds).toContain(toActivityId);
      expect(activityIds).not.toContain(fromActivityId);
      expect(
        patchedPerson.assignments.find(
          (a: any) => a.activityId === toActivityId,
        ).assignmentCode,
      ).toBe('competitor');
      expect(
        await db.staffActivity.count({
          where: {
            personId: movedPerson.id,
            groupId: { startsWith: `${ROUND_ID}-g` },
            role: StaffRole.COMPETITOR,
          },
        }),
      ).toBe(1);

      await db.staffActivity.update({
        where: { id: activityId },
        data: { groupId: FROM_GROUP },
      });
    });

    it('keeps the group when the WCA rejects the WCIF update', async () => {
      patchStatus = 422;
      try {
        const res = await request(server())
          .post('/person/change-group')
          .set(auth(users.tokens.ORGANIZER))
          .send({ personId: movedPerson.id, newGroupId: TO_GROUP })
          .expect(422);

        expect(res.body).toEqual({
          message: 'The WCA rejected the WCIF update',
          error: 'E2E rejected',
        });
        const activity = await db.staffActivity.findUnique({
          where: { id: activityId },
        });
        expect(activity.groupId).toBe(FROM_GROUP);
      } finally {
        patchStatus = 200;
      }
    });

    it('returns 403 for a user who did not log in with WCA', async () => {
      const res = await request(server())
        .post('/person/change-group')
        .set(auth(adminToken))
        .send({ personId: movedPerson.id, newGroupId: TO_GROUP })
        .expect(403);

      expect(res.body.message).toBe('You are not allowed to access WCIF');
    });

    it.each(['STAFF', 'STAGE_LEADER'] as const)(
      'returns 403 for %s',
      async (role) => {
        await request(server())
          .post('/person/change-group')
          .set(auth(users.tokens[role]))
          .send({ personId: movedPerson.id, newGroupId: TO_GROUP })
          .expect(403);
      },
    );

    it('returns 401 when not authenticated', async () => {
      await request(server())
        .post('/person/change-group')
        .send({ personId: movedPerson.id, newGroupId: TO_GROUP })
        .expect(401);
    });
  });
});
