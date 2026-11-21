import { INestApplication } from '@nestjs/common';
import { Socket } from 'socket.io-client';
import { AppGateway } from 'src/app.gateway';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';

import {
  Person,
  Role,
  StaffActivity,
  StaffActivityStatus,
  StaffRole,
} from '../src/generated/prisma/client';
import { createTestApp } from './helpers/app.helper';
import {
  createTestPersons,
  deleteTestPersons,
} from './helpers/competition-day.helper';
import {
  createUserWithRoles,
  deleteSetupUsers,
  TestUser,
} from './helpers/setup-roles.helper';
import {
  connectSocketIo,
  isSocketInRoom,
  joinRoom,
  listenOnRandomPort,
  waitForEvent,
} from './helpers/socketio.helper';

// The seeded schedule puts even groups in Side Hall and odd ones in Main
// Hall; 666 only runs in Main Hall
const SUFFIX = 'stage-lead-rooms';
const REGISTRANT_IDS = [9411, 9412];
const SIDE_GROUP = '333-r1-g2';
const MAIN_GROUP = '333-r1-g1';
const MAIN_ONLY_ROUND = '666-r1';
const CHOOSE_ROOMS = 'Choose the rooms this stage lead takes attendance in';

describe('Stage leads for some rooms (e2e, SPEC-016)', () => {
  let app: INestApplication;
  let db: DbService;
  let gateway: AppGateway;
  let url: string;
  let adminToken: string;
  let sideRoomId: string;
  let mainRoomId: string;
  let sideLead: TestUser;
  let allRoomsLead: TestUser;
  let person: Person;
  let other: Person;
  let sideActivity: StaffActivity;
  let mainActivity: StaffActivity;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    ({ app, db, adminToken } = await createTestApp());
    gateway = app.get(AppGateway);
    url = await listenOnRandomPort(app);
    const roomId = async (name: string) =>
      (await db.room.findFirstOrThrow({ where: { name } })).id;
    sideRoomId = await roomId('Side Hall');
    mainRoomId = await roomId('Main Hall');

    sideLead = await createUserWithRoles(app, db, `side-${SUFFIX}`, [
      Role.STAGE_LEADER,
    ]);
    await db.stageLeadRoom.create({
      data: { userId: sideLead.id, roomId: sideRoomId },
    });
    // No rows: every stage lead from before rooms existed
    allRoomsLead = await createUserWithRoles(app, db, `all-${SUFFIX}`, [
      Role.STAGE_LEADER,
    ]);

    [person, other] = await createTestPersons(
      db,
      'Stage Lead Rooms',
      REGISTRANT_IDS,
    );
    const assign = (personId: string, groupId: string) =>
      db.staffActivity.create({
        data: { personId, groupId, role: StaffRole.JUDGE, isAssigned: true },
      });
    sideActivity = await assign(person.id, SIDE_GROUP);
    mainActivity = await assign(person.id, MAIN_GROUP);
    await assign(other.id, MAIN_GROUP);
  }, 30000);

  afterAll(async () => {
    try {
      sockets.forEach((socket) => socket.close());
      await deleteTestPersons(db, { registrantIds: REGISTRANT_IDS });
      await deleteSetupUsers(db, SUFFIX);
    } finally {
      await app.close();
    }
  }, 30000);

  const server = () => app.getHttpServer();
  const as = (user: { token: string }) => ({
    Authorization: `Bearer ${user.token}`,
  });
  const group = (id: string) => encodeURIComponent(id);

  it('tells the panel which rooms and groups the stage lead covers', async () => {
    const res = await request(server())
      .get('/attendance/scope')
      .set(as(sideLead))
      .expect(200);
    expect(res.body).toMatchObject({
      allRooms: false,
      rooms: [{ id: sideRoomId, name: 'Side Hall' }],
    });
    expect(res.body.groupIds).toContain(SIDE_GROUP);
    expect(res.body.groupIds).not.toContain(MAIN_GROUP);

    const all = await request(server())
      .get('/attendance/scope')
      .set(as(allRoomsLead))
      .expect(200);
    expect(all.body).toEqual({ allRooms: true, rooms: [], groupIds: [] });
  });

  it("reads their room's group and refuses another room's", async () => {
    await request(server())
      .get(`/attendance/group/${group(SIDE_GROUP)}`)
      .set(as(sideLead))
      .expect(200);
    const res = await request(server())
      .get(`/attendance/group/${group(MAIN_GROUP)}`)
      .set(as(sideLead))
      .expect(403);
    expect(res.body.message).toBe('You take attendance for Side Hall only');
  });

  it.each([
    ['post', 'present', undefined],
    ['post', 'absent', undefined],
    ['post', 'late', undefined],
    ['post', 'replaced', { wasPresent: true }],
    ['put', 'left-early', { leftEarly: false }],
    ['put', 'comment', { comment: 'from the side hall' }],
    [
      'put',
      'restore',
      { status: StaffActivityStatus.ABSENT, leftEarly: false, noShow: false },
    ],
  ] as const)(
    '%s /attendance/%s works in their room and is refused in another',
    async (method, path, body) => {
      await request(server())
        [method](`/attendance/${path}/${sideActivity.id}`)
        .set(as(sideLead))
        .send(body ?? {})
        .expect((res) => expect(res.status).toBeLessThan(300));
      await request(server())
        [method](`/attendance/${path}/${mainActivity.id}`)
        .set(as(sideLead))
        .send(body ?? {})
        .expect(403);
    },
  );

  it('adds an unassigned person only to their room', async () => {
    await request(server())
      .post(`/attendance/unassigned/${group(SIDE_GROUP)}`)
      .set(as(sideLead))
      .send({ personId: other.id, role: StaffRole.STAFF_OTHER })
      .expect(201);
    await request(server())
      .post(`/attendance/unassigned/${group(MAIN_GROUP)}`)
      .set(as(sideLead))
      .send({ personId: other.id, role: StaffRole.STAFF_OTHER })
      .expect(403);
  });

  it('tags a whole day as no-show once one group is theirs', async () => {
    await db.staffActivity.updateMany({
      where: { personId: person.id },
      data: { status: StaffActivityStatus.ABSENT, noShow: false },
    });
    await request(server())
      .post('/attendance/no-show')
      .set(as(sideLead))
      .send({
        personId: person.id,
        groupIds: [SIDE_GROUP, MAIN_GROUP],
        noShow: true,
      })
      .expect(201);
    const tagged = await db.staffActivity.findMany({
      where: { personId: person.id },
    });
    expect(tagged.every((activity) => activity.noShow)).toBe(true);

    await request(server())
      .post('/attendance/no-show')
      .set(as(sideLead))
      .send({ personId: other.id, groupIds: [MAIN_GROUP], noShow: true })
      .expect(403);
  });

  it("reads a person's whole day, which no-show for the day needs", async () => {
    const res = await request(server())
      .get(`/attendance/person/${person.id}`)
      .set(as(sideLead))
      .expect(200);
    expect(res.body.map((a: StaffActivity) => a.groupId).sort()).toEqual(
      [MAIN_GROUP, SIDE_GROUP].sort(),
    );
  });

  it('reads staffing only for rounds with a group in their room', async () => {
    await request(server())
      .get('/attendance/round/333-r1/staffing')
      .set(as(sideLead))
      .expect(200);
    await request(server())
      .get(`/attendance/round/${MAIN_ONLY_ROUND}/staffing`)
      .set(as(sideLead))
      .expect(403);
  });

  it('keeps the competition-wide reports open', async () => {
    await request(server())
      .get('/attendance/statistics')
      .set(as(sideLead))
      .expect(200);
    await request(server())
      .get('/attendance/missed')
      .set(as(sideLead))
      .expect(200);
  });

  it('lets a stage lead with all rooms into any group', async () => {
    await request(server())
      .get(`/attendance/group/${group(MAIN_GROUP)}`)
      .set(as(allRoomsLead))
      .expect(200);
    await request(server())
      .post(`/attendance/present/${mainActivity.id}`)
      .set(as(allRoomsLead))
      .expect(201);
  });

  describe('live attendance', () => {
    const connect = async (token: string) => {
      const socket = await connectSocketIo(url, token);
      sockets.push(socket);
      return socket;
    };

    it("joins their room's group and gets updates", async () => {
      const socket = await connect(sideLead.token);
      await joinRoom(
        gateway,
        socket,
        'joinAttendance',
        `attendance-${SIDE_GROUP}`,
        { groupId: SIDE_GROUP },
      );
      const update = waitForEvent(socket, 'newAttendance');
      await request(server())
        .post(`/attendance/present/${sideActivity.id}`)
        .set({ Authorization: `Bearer ${adminToken}` })
        .expect(201);
      expect(await update).toEqual({ competitorId: person.id });
    });

    it("is refused another room's group", async () => {
      const socket = await connect(sideLead.token);
      const exception = waitForEvent(socket, 'exception');
      socket.emit('joinAttendance', { groupId: MAIN_GROUP });
      expect(await exception).toMatchObject({ status: 'error' });
      expect(
        await isSocketInRoom(gateway, `attendance-${MAIN_GROUP}`, socket),
      ).toBe(false);
    });
  });

  describe('giving the role', () => {
    const createUser = (body: object) =>
      request(server())
        .post('/user')
        .set({ Authorization: `Bearer ${adminToken}` })
        .send({
          username: `e2e-setup-new-${SUFFIX}`,
          fullName: 'New Lead',
          password: 'invented-pass-1',
          roles: [Role.STAGE_LEADER],
          ...body,
        });

    afterEach(() =>
      db.user.deleteMany({ where: { username: `e2e-setup-new-${SUFFIX}` } }),
    );

    it('refuses a stage lead without rooms', async () => {
      const res = await createUser({}).expect(400);
      expect(res.body.message).toBe(CHOOSE_ROOMS);
    });

    it('saves the chosen rooms and lists them', async () => {
      await createUser({ stageLeadRoomIds: [sideRoomId] }).expect(201);
      const users = await request(server())
        .get('/user')
        .set({ Authorization: `Bearer ${adminToken}` })
        .expect(200);
      const created = users.body.find(
        (u: { username: string }) => u.username === `e2e-setup-new-${SUFFIX}`,
      );
      expect(created.stageLeadRoomIds).toEqual([sideRoomId]);
    });

    it('saves all rooms, and clears rooms when the role goes', async () => {
      await createUser({ stageLeadAllRooms: true }).expect(201);
      const user = await db.user.findFirstOrThrow({
        where: { username: `e2e-setup-new-${SUFFIX}` },
        include: { stageLeadRooms: true },
      });
      expect(user.stageLeadRooms).toEqual([]);

      await request(server())
        .put(`/user/${user.id}`)
        .set({ Authorization: `Bearer ${adminToken}` })
        .send({
          username: user.username,
          fullName: 'New Lead',
          roles: [Role.STAGE_LEADER],
          stageLeadRoomIds: [mainRoomId],
        })
        .expect(200);
      expect(
        await db.stageLeadRoom.findMany({ where: { userId: user.id } }),
      ).toEqual([{ userId: user.id, roomId: mainRoomId }]);

      await request(server())
        .put(`/user/${user.id}`)
        .set({ Authorization: `Bearer ${adminToken}` })
        .send({
          username: user.username,
          fullName: 'New Lead',
          roles: [Role.STAFF],
        })
        .expect(200);
      expect(
        await db.stageLeadRoom.findMany({ where: { userId: user.id } }),
      ).toEqual([]);
    });
  });
});
