import { INestApplication } from '@nestjs/common';
import {
  Person,
  StaffActivity,
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
} from './helpers/competition-day.helper';

const PREFIX = 'e2e-attendance';
const REGISTRANT_IDS = [9301, 9302, 9303, 9304];
// A round with results (so it "took place") and one that never gets any
const ROUND_ID = 'minx-r3';
const GROUP_ID = `${ROUND_ID}-g1`;
const NOT_HELD_GROUP_ID = 'pyram-r4-g1';
const NON_EXISTENT_ID = '00000000-0000-0000-0000-000000000000';

describe('Attendance flow for a group (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let adminToken: string;
  let users: RoleUsers;
  let judge: Person;
  let scrambler: Person;
  let competitor: Person;
  let helper: Person;
  let judgeActivity: StaffActivity;
  let scramblerActivity: StaffActivity;
  let runnerActivity: StaffActivity;
  let competitorActivity: StaffActivity;
  let notHeldActivity: StaffActivity;

  beforeAll(async () => {
    ({ app, db, adminToken } = await createTestApp());
    users = await createRoleUsers(app, db, PREFIX);
    [judge, scrambler, competitor, helper] = await createTestPersons(
      db,
      'Attendance',
      REGISTRANT_IDS,
    );
    const assign = (personId: string, role: StaffRole, groupId = GROUP_ID) =>
      db.staffActivity.create({
        data: { personId, role, groupId, isAssigned: true },
      });
    judgeActivity = await assign(judge.id, StaffRole.JUDGE);
    scramblerActivity = await assign(judge.id, StaffRole.SCRAMBLER);
    notHeldActivity = await assign(
      judge.id,
      StaffRole.RUNNER,
      NOT_HELD_GROUP_ID,
    );
    runnerActivity = await assign(scrambler.id, StaffRole.RUNNER);
    competitorActivity = await assign(competitor.id, StaffRole.COMPETITOR);
    // A result in the round marks it as having taken place
    await db.result.create({
      data: {
        personId: competitor.id,
        eventId: 'minx',
        roundId: ROUND_ID,
      },
    });
  }, 30000);

  afterAll(async () => {
    try {
      await deleteTestPersons(db, { registrantIds: REGISTRANT_IDS });
      await users.cleanup();
    } finally {
      await app.close();
    }
  }, 30000);

  const server = () => app.getHttpServer();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const statusOf = async (id: string) =>
    (await db.staffActivity.findUnique({ where: { id } }))?.status;

  describe('GET /attendance/group/:groupId', () => {
    it('lists every assignment of the group with the person', async () => {
      const res = await request(server())
        .get(`/attendance/group/${GROUP_ID}`)
        .set(auth(users.tokens.STAGE_LEADER))
        .expect(200);

      const mine = res.body.filter((a: any) =>
        [judge.id, scrambler.id, competitor.id].includes(a.personId),
      );
      expect(mine).toHaveLength(4);
      const judging = mine.find((a: any) => a.id === judgeActivity.id);
      expect(judging).toMatchObject({
        role: StaffRole.JUDGE,
        status: StaffActivityStatus.ABSENT,
        isAssigned: true,
        person: { id: judge.id, name: judge.name },
      });
      res.body.forEach((a: any) => expect(a.groupId).toBe(GROUP_ID));
    });
  });

  describe('GET /attendance/round/:roundId/staffing', () => {
    it('reports assigned runners only', async () => {
      const res = await request(server())
        .get(`/attendance/round/${ROUND_ID}/staffing`)
        .set(auth(users.tokens.STAGE_LEADER))
        .expect(200);
      expect(res.body).toEqual({ hasAssignedRunners: true });

      await db.staffActivity.update({
        where: { id: runnerActivity.id },
        data: { isAssigned: false },
      });
      try {
        const without = await request(server())
          .get(`/attendance/round/${ROUND_ID}/staffing`)
          .set(auth(adminToken))
          .expect(200);
        expect(without.body).toEqual({ hasAssignedRunners: false });
      } finally {
        await db.staffActivity.update({
          where: { id: runnerActivity.id },
          data: { isAssigned: true },
        });
      }
    });
  });

  describe('marking attendance', () => {
    it('marks staff present, late, replaced and absent', async () => {
      const present = await request(server())
        .post(`/attendance/present/${judgeActivity.id}`)
        .set(auth(users.tokens.STAGE_LEADER))
        .expect(201);
      expect(present.body).toMatchObject({
        id: judgeActivity.id,
        status: StaffActivityStatus.PRESENT,
      });
      expect(await statusOf(judgeActivity.id)).toBe(
        StaffActivityStatus.PRESENT,
      );

      await request(server())
        .post(`/attendance/late/${runnerActivity.id}`)
        .set(auth(users.tokens.ORGANIZER))
        .expect(201);
      expect(await statusOf(runnerActivity.id)).toBe(StaffActivityStatus.LATE);

      await request(server())
        .post(`/attendance/replaced/${notHeldActivity.id}`)
        .set(auth(users.tokens.DELEGATE))
        .send({ wasPresent: true })
        .expect(201);
      expect(await statusOf(notHeldActivity.id)).toBe(
        StaffActivityStatus.REPLACED,
      );

      await request(server())
        .post(`/attendance/present/${scramblerActivity.id}`)
        .set(auth(adminToken))
        .expect(201);
      const absent = await request(server())
        .post(`/attendance/absent/${scramblerActivity.id}`)
        .set(auth(adminToken))
        .expect(201);
      expect(absent.body.id).toBe(scramblerActivity.id);
      // An assigned activity is kept and flagged absent
      expect(await statusOf(scramblerActivity.id)).toBe(
        StaffActivityStatus.ABSENT,
      );
    });

    it('stores and clears a comment', async () => {
      const res = await request(server())
        .put(`/attendance/comment/${scramblerActivity.id}`)
        .set(auth(users.tokens.STAGE_LEADER))
        .send({ comment: 'E2E came after the group started' })
        .expect(200);
      expect(res.body.comment).toBe('E2E came after the group started');

      const updated = await db.staffActivity.findUnique({
        where: { id: scramblerActivity.id },
      });
      expect(updated.comment).toBe('E2E came after the group started');
    });

    it('returns 404 when marking an unknown activity absent', async () => {
      await request(server())
        .post(`/attendance/absent/${NON_EXISTENT_ID}`)
        .set(auth(adminToken))
        .expect(404);
    });

    it('returns 404 when marking an unknown activity present', async () => {
      await request(server())
        .post(`/attendance/present/${NON_EXISTENT_ID}`)
        .set(auth(adminToken))
        .expect(404);
    });
  });

  describe('POST /attendance/unassigned/:groupId', () => {
    it('adds an unassigned helper as present and removes them when absent', async () => {
      const res = await request(server())
        .post(`/attendance/unassigned/${GROUP_ID}`)
        .set(auth(users.tokens.STAGE_LEADER))
        .send({ personId: helper.id, role: StaffRole.JUDGE })
        .expect(201);

      expect(res.body).toMatchObject({
        personId: helper.id,
        groupId: GROUP_ID,
        role: StaffRole.JUDGE,
        status: StaffActivityStatus.PRESENT,
        isAssigned: false,
      });

      const conflict = await request(server())
        .post(`/attendance/unassigned/${GROUP_ID}`)
        .set(auth(adminToken))
        .send({ personId: helper.id, role: StaffRole.JUDGE })
        .expect(409);
      expect(conflict.body.message).toBe(
        'This person is already marked as present in this group in another role.',
      );

      await request(server())
        .post(`/attendance/absent/${res.body.id}`)
        .set(auth(adminToken))
        .expect(201);
      // An unassigned activity disappears instead of counting as missed
      expect(
        await db.staffActivity.findUnique({ where: { id: res.body.id } }),
      ).toBeNull();
    });

    it('marks an assigned but absent person present again', async () => {
      const res = await request(server())
        .post(`/attendance/unassigned/${GROUP_ID}`)
        .set(auth(adminToken))
        .send({ personId: judge.id, role: StaffRole.SCRAMBLER })
        .expect(201);

      expect(res.body.id).toBe(scramblerActivity.id);
      expect(res.body.status).toBe(StaffActivityStatus.PRESENT);
      // Assignment stays assigned
      expect(res.body.isAssigned).toBe(true);

      await db.staffActivity.update({
        where: { id: scramblerActivity.id },
        data: { status: StaffActivityStatus.ABSENT },
      });
    });

    it('returns 404 for an unknown person', async () => {
      await request(server())
        .post(`/attendance/unassigned/${GROUP_ID}`)
        .set(auth(adminToken))
        .send({ personId: NON_EXISTENT_ID, role: StaffRole.JUDGE })
        .expect(404);
    });

    it('validates the role', async () => {
      await request(server())
        .post(`/attendance/unassigned/${GROUP_ID}`)
        .set(auth(adminToken))
        .send({ personId: helper.id, role: 'CHEERLEADER' })
        .expect(400);
    });
  });

  describe('reports', () => {
    it('GET /attendance/person/:id lists all activities of a person', async () => {
      const res = await request(server())
        .get(`/attendance/person/${judge.id}`)
        .set(auth(users.tokens.STAGE_LEADER))
        .expect(200);

      expect(res.body.map((a: any) => a.id).sort()).toEqual(
        [judgeActivity.id, scramblerActivity.id, notHeldActivity.id].sort(),
      );
    });

    it('GET /attendance/missed counts missed, late and replaced staffing', async () => {
      // Competitor no-shows are not missed staffing assignments
      expect(await statusOf(competitorActivity.id)).toBe(
        StaffActivityStatus.ABSENT,
      );

      const res = await request(server())
        .get('/attendance/missed')
        .set(auth(users.tokens.STAGE_LEADER))
        .expect(200);

      const forJudge = res.body.find((e: any) => e.person.id === judge.id);
      expect(forJudge).toMatchObject({
        missedAssignmentsCount: 1,
        lateAssignmentsCount: 0,
        presentButReplacedAssignmentsCount: 1,
        commentsCount: 1,
      });
      expect(forJudge.missedAssignments[0].id).toBe(scramblerActivity.id);
      expect(forJudge.comments[0].comment).toBe(
        'E2E came after the group started',
      );

      const forRunner = res.body.find((e: any) => e.person.id === scrambler.id);
      expect(forRunner).toMatchObject({
        missedAssignmentsCount: 0,
        lateAssignmentsCount: 1,
      });

      const forCompetitor = res.body.find(
        (e: any) => e.person.id === competitor.id,
      );
      expect(forCompetitor.missedAssignmentsCount).toBe(0);

      const counts = res.body.map((e: any) => e.missedAssignmentsCount);
      expect(counts).toEqual([...counts].sort((a, b) => b - a));
    });

    it('GET /attendance/statistics only compares against rounds that took place', async () => {
      const res = await request(server())
        .get('/attendance/statistics')
        .set(auth(users.tokens.STAGE_LEADER))
        .expect(200);

      const forJudge = res.body.find((e: any) => e.personName === judge.name);
      // judge + scrambler in a held round, runner in a round without results
      expect(forJudge).toEqual({
        personName: judge.name,
        totalAssignedStaffing: 3,
        totalStaffingComparedToRounds: 2,
        totalPresentAtStaffingComparedToRounds: 1,
        presentPercentage: 50,
      });

      const forCompetitor = res.body.find(
        (e: any) => e.personName === competitor.name,
      );
      expect(forCompetitor).toEqual({
        personName: competitor.name,
        totalAssignedStaffing: 0,
        totalStaffingComparedToRounds: 0,
        totalPresentAtStaffingComparedToRounds: 0,
        presentPercentage: 0,
      });
    });
  });

  describe('tags', () => {
    // Groups of their own, so the reports above keep their counts
    const TAGS_GROUP_ID = `${ROUND_ID}-g2`;
    const LATER_GROUP_ID = `${ROUND_ID}-g3`;
    const OTHER_DAY_GROUP_ID = `${ROUND_ID}-g4`;
    const assign = (personId: string, role: StaffRole, groupId: string) =>
      db.staffActivity.create({
        data: { personId, role, groupId, isAssigned: true },
      });
    const activityOf = (id: string) =>
      db.staffActivity.findUnique({ where: { id } });

    it('marks someone who did the job as left early, alongside late', async () => {
      const activity = await assign(helper.id, StaffRole.JUDGE, TAGS_GROUP_ID);

      await request(server())
        .put(`/attendance/left-early/${activity.id}`)
        .set(auth(users.tokens.STAGE_LEADER))
        .send({ leftEarly: true })
        .expect(409);

      await request(server())
        .post(`/attendance/late/${activity.id}`)
        .set(auth(adminToken))
        .expect(201);
      const res = await request(server())
        .put(`/attendance/left-early/${activity.id}`)
        .set(auth(users.tokens.STAGE_LEADER))
        .send({ leftEarly: true })
        .expect(200);
      expect(res.body).toMatchObject({
        status: StaffActivityStatus.LATE,
        leftEarly: true,
      });

      await request(server())
        .post(`/attendance/absent/${activity.id}`)
        .set(auth(adminToken))
        .expect(201);
      expect(await activityOf(activity.id)).toMatchObject({
        status: StaffActivityStatus.ABSENT,
        leftEarly: false,
      });
    });

    it('records who replaced someone who was here, and adds them once', async () => {
      const activity = await assign(
        helper.id,
        StaffRole.SCRAMBLER,
        TAGS_GROUP_ID,
      );
      const markReplaced = () =>
        request(server())
          .post(`/attendance/replaced/${activity.id}`)
          .set(auth(users.tokens.STAGE_LEADER))
          .send({ wasPresent: true, replacedById: competitor.id })
          .expect(201);

      const res = await markReplaced();
      expect(res.body).toMatchObject({
        status: StaffActivityStatus.REPLACED,
        replacedById: competitor.id,
      });
      await markReplaced();

      const replacements = await db.staffActivity.findMany({
        where: {
          personId: competitor.id,
          groupId: TAGS_GROUP_ID,
          role: StaffRole.SCRAMBLER,
        },
      });
      expect(replacements).toHaveLength(1);
      expect(replacements[0]).toMatchObject({
        status: StaffActivityStatus.PRESENT,
        isAssigned: false,
      });

      const group = await request(server())
        .get(`/attendance/group/${TAGS_GROUP_ID}`)
        .set(auth(adminToken))
        .expect(200);
      expect(group.body.find((a: any) => a.id === activity.id)).toMatchObject({
        replacedBy: { id: competitor.id, name: competitor.name },
      });
    });

    it("keeps someone who didn't come absent, covered by their replacement", async () => {
      const activity = await assign(helper.id, StaffRole.RUNNER, TAGS_GROUP_ID);

      await request(server())
        .post(`/attendance/replaced/${activity.id}`)
        .set(auth(adminToken))
        .send({ wasPresent: false, replacedById: competitor.id })
        .expect(201);
      expect(await activityOf(activity.id)).toMatchObject({
        status: StaffActivityStatus.ABSENT,
        replacedById: competitor.id,
      });

      // Doing the job after all means nobody covered for them
      await request(server())
        .post(`/attendance/present/${activity.id}`)
        .set(auth(adminToken))
        .expect(201);
      expect((await activityOf(activity.id)).replacedById).toBeNull();
    });

    it('rejects a replacement who is the same person, or unknown', async () => {
      const activity = await assign(
        helper.id,
        StaffRole.DELEGATE,
        TAGS_GROUP_ID,
      );
      await request(server())
        .post(`/attendance/replaced/${activity.id}`)
        .set(auth(adminToken))
        .send({ wasPresent: true, replacedById: helper.id })
        .expect(400);
      await request(server())
        .post(`/attendance/replaced/${activity.id}`)
        .set(auth(adminToken))
        .send({ wasPresent: true, replacedById: NON_EXISTENT_ID })
        .expect(404);
      await request(server())
        .post(`/attendance/replaced/${NON_EXISTENT_ID}`)
        .set(auth(adminToken))
        .send({ wasPresent: true })
        .expect(404);
    });

    it('tags only the absent staffing in the given groups as not coming', async () => {
      const later = await assign(scrambler.id, StaffRole.JUDGE, LATER_GROUP_ID);
      const done = await assign(scrambler.id, StaffRole.JUDGE, TAGS_GROUP_ID);
      await db.staffActivity.update({
        where: { id: done.id },
        data: { status: StaffActivityStatus.PRESENT },
      });
      const competing = await assign(
        scrambler.id,
        StaffRole.COMPETITOR,
        LATER_GROUP_ID,
      );
      const otherDay = await assign(
        scrambler.id,
        StaffRole.JUDGE,
        OTHER_DAY_GROUP_ID,
      );
      const setNoShow = (noShow: boolean) =>
        request(server())
          .post('/attendance/no-show')
          .set(auth(users.tokens.STAGE_LEADER))
          .send({
            personId: scrambler.id,
            groupIds: [TAGS_GROUP_ID, LATER_GROUP_ID],
            noShow,
          })
          .expect(201);

      expect((await setNoShow(true)).body).toEqual({ count: 1 });
      expect((await activityOf(later.id)).noShow).toBe(true);
      expect((await activityOf(done.id)).noShow).toBe(false);
      expect((await activityOf(competing.id)).noShow).toBe(false);
      expect((await activityOf(otherDay.id)).noShow).toBe(false);

      await setNoShow(false);
      expect((await activityOf(later.id)).noShow).toBe(false);

      await setNoShow(true);
      await request(server())
        .post(`/attendance/present/${later.id}`)
        .set(auth(adminToken))
        .expect(201);
      expect((await activityOf(later.id)).noShow).toBe(false);
    });

    it("restores a row for undo, dropping tags its status can't have", async () => {
      const activity = await assign(
        scrambler.id,
        StaffRole.SCRAMBLER,
        TAGS_GROUP_ID,
      );
      const res = await request(server())
        .put(`/attendance/restore/${activity.id}`)
        .set(auth(users.tokens.STAGE_LEADER))
        .send({
          status: StaffActivityStatus.LATE,
          leftEarly: true,
          noShow: true,
          replacedById: competitor.id,
        })
        .expect(200);
      expect(res.body).toMatchObject({
        status: StaffActivityStatus.LATE,
        leftEarly: true,
        noShow: false,
        replacedById: null,
      });
    });
  });

  describe('guards', () => {
    const endpoints: [string, string, () => string, object][] = [
      ['get', 'group', () => `/attendance/group/${GROUP_ID}`, {}],
      ['get', 'staffing', () => `/attendance/round/${ROUND_ID}/staffing`, {}],
      ['get', 'statistics', () => '/attendance/statistics', {}],
      ['get', 'missed', () => '/attendance/missed', {}],
      ['get', 'person', () => `/attendance/person/${judge.id}`, {}],
      [
        'post',
        'unassigned',
        () => `/attendance/unassigned/${GROUP_ID}`,
        { personId: NON_EXISTENT_ID, role: StaffRole.JUDGE },
      ],
      ['post', 'present', () => `/attendance/present/${judgeActivity.id}`, {}],
      ['post', 'absent', () => `/attendance/absent/${judgeActivity.id}`, {}],
      [
        'post',
        'replaced',
        () => `/attendance/replaced/${judgeActivity.id}`,
        { wasPresent: true },
      ],
      [
        'put',
        'left-early',
        () => `/attendance/left-early/${judgeActivity.id}`,
        { leftEarly: true },
      ],
      [
        'post',
        'no-show',
        () => '/attendance/no-show',
        { personId: NON_EXISTENT_ID, groupIds: [GROUP_ID], noShow: true },
      ],
      [
        'put',
        'restore',
        () => `/attendance/restore/${judgeActivity.id}`,
        {
          status: StaffActivityStatus.ABSENT,
          leftEarly: false,
          noShow: false,
        },
      ],
      ['post', 'late', () => `/attendance/late/${judgeActivity.id}`, {}],
      [
        'put',
        'comment',
        () => `/attendance/comment/${judgeActivity.id}`,
        { comment: 'E2E forbidden' },
      ],
    ];

    it.each(endpoints)(
      '%s %s rejects staff without stage leader rights',
      async (method, _name, url, body) => {
        for (const role of ['STAFF', 'NO_ROLE'] as const) {
          await (request(server()) as any)
            [method](url())
            .set(auth(users.tokens[role]))
            .send(body)
            .expect(403);
        }
        await (request(server()) as any)[method](url()).send(body).expect(401);
      },
    );

    it('leaves the data untouched after rejected requests', async () => {
      const activity = await db.staffActivity.findUnique({
        where: { id: judgeActivity.id },
      });
      expect(activity.status).toBe(StaffActivityStatus.PRESENT);
      expect(activity.comment).toBeNull();
    });
  });
});
