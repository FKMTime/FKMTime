import { INestApplication } from '@nestjs/common';
import {
  AttemptStatus,
  AttemptType,
  Device,
  Person,
  Role,
  Room,
  StaffRole,
} from '@prisma/client';
import { Socket } from 'socket.io-client';
import { AppGateway } from 'src/app.gateway';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';

import { createTestApp } from './helpers/app.helper';
import {
  createTestPersons,
  deleteTestPersons,
  stubExternalApis,
} from './helpers/competition-day.helper';
import {
  createUserWithRoles,
  deleteSetupUsers,
} from './helpers/setup-roles.helper';
import {
  connectSocketIo,
  joinRoom,
  listenOnRandomPort,
  waitForEvent,
} from './helpers/socketio.helper';
import { StationFixtures } from './helpers/station-fixtures.helper';

/**
 * SPEC-013: a delegate gives a user delegate access for one group. It works
 * while the group runs, covers the competitors who solve in it, allows only
 * what the delegate ticked, and ends with the group.
 */
const PREFIX = 'e2e-delegate-grant';
const GROUP = '333-r1-g2';
const NEXT_GROUP = '333-r1-g3';
const ROUND = '333-r1';
const REGISTRANT_IDS = [9711, 9712, 9713];
const USER_SUFFIX = 'delegate-grant';

describe('Delegate access for one group (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let adminToken: string;
  let fixtures: StationFixtures;
  let stub: ReturnType<typeof stubExternalApis>;
  let delegate: { id: string; token: string };
  let helper: { id: string; token: string };
  let otherDelegate: { id: string; token: string };
  let room: Room;
  let otherRoom: Room;
  let station: Device;
  let otherStation: Device;
  /** Assigned to GROUP */
  let assigned: Person;
  /** Assigned elsewhere, solves in GROUP's room anyway */
  let walkIn: Person;
  /** Solves in another room */
  let outsider: Person;
  let grantId: string;
  let roomsBefore: { id: string; currentGroupIds: string[] }[];

  const server = () => app.getHttpServer();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const setRoomGroups = (groupIds: string[]) =>
    request(server())
      .put('/competition/rooms')
      .set(auth(adminToken))
      .send({
        rooms: [
          { id: room.id, currentGroupIds: groupIds },
          { id: otherRoom.id, currentGroupIds: [] },
        ],
      })
      .expect(200);

  const incident = async (
    person: Person,
    device: Device,
    attemptNumber = 1,
    status: AttemptStatus = AttemptStatus.UNRESOLVED,
  ) => {
    const result = await db.result.upsert({
      where: { personId_roundId: { personId: person.id, roundId: ROUND } },
      update: {},
      create: { personId: person.id, roundId: ROUND, eventId: '333' },
    });
    return db.attempt.create({
      data: {
        resultId: result.id,
        attemptNumber,
        value: 1234,
        penalty: 0,
        status,
        type: AttemptType.STANDARD_ATTEMPT,
        deviceId: device.id,
        solvedAt: new Date(),
      },
    });
  };

  const resolve = (token: string, attempt: { id: string }, extra = {}) =>
    request(server())
      .put(`/attempt/${attempt.id}`)
      .set(auth(token))
      .send({
        attemptNumber: 1,
        status: AttemptStatus.RESOLVED,
        type: AttemptType.STANDARD_ATTEMPT,
        penalty: 2,
        value: 1234,
        doNotRequireCards: true,
        ...extra,
      });

  beforeAll(async () => {
    ({ app, db, adminToken } = await createTestApp());
    stub = stubExternalApis();
    fixtures = new StationFixtures(db, PREFIX);
    await fixtures.purgeLeftovers([]);
    await fixtures.disableResultSubmission();
    await db.delegateGrant.deleteMany({ where: { groupId: GROUP } });

    await deleteSetupUsers(db, USER_SUFFIX);
    const user = (name: string, roles: Role[]) =>
      createUserWithRoles(app, db, `${name}-${USER_SUFFIX}`, roles);
    delegate = await user('delegate', [Role.DELEGATE]);
    helper = await user('helper', [Role.STAFF]);
    otherDelegate = await user('other-delegate', [Role.DELEGATE]);

    // Only this spec's rooms run anything while it runs
    roomsBefore = await db.room.findMany({
      select: { id: true, currentGroupIds: true },
    });
    await db.room.updateMany({ data: { currentGroupIds: [] } });
    room = await fixtures.createRoom('main', []);
    otherRoom = await fixtures.createRoom('side', []);
    station = await fixtures.createDevice('station', 997101, room.id);
    otherStation = await fixtures.createDevice(
      'side-station',
      997102,
      otherRoom.id,
    );

    [assigned, walkIn, outsider] = await createTestPersons(
      db,
      'Grant',
      REGISTRANT_IDS,
    );
    await db.staffActivity.createMany({
      data: [
        {
          personId: assigned.id,
          groupId: GROUP,
          role: StaffRole.COMPETITOR,
          isAssigned: true,
        },
        {
          personId: walkIn.id,
          groupId: '333-r1-g1',
          role: StaffRole.COMPETITOR,
          isAssigned: true,
        },
      ],
    });
  }, 30000);

  afterAll(async () => {
    try {
      stub.restore();
      await db.delegateGrant.deleteMany({ where: { groupId: GROUP } });
      await deleteTestPersons(db, { registrantIds: REGISTRANT_IDS });
      await fixtures.cleanup();
      await deleteSetupUsers(db, USER_SUFFIX);
      for (const before of roomsBefore) {
        await db.room.update({
          where: { id: before.id },
          data: { currentGroupIds: before.currentGroupIds },
        });
      }
    } finally {
      await app.close();
    }
  }, 30000);

  it('refuses giving access to a delegate', async () => {
    await request(server())
      .post('/delegate-grant')
      .set(auth(delegate.token))
      .send({ userId: otherDelegate.id, groupId: GROUP, permissions: [] })
      .expect(400);
  });

  it('lets only delegates give access', async () => {
    await request(server())
      .post('/delegate-grant')
      .set(auth(helper.token))
      .send({ userId: helper.id, groupId: GROUP, permissions: [] })
      .expect(403);
  });

  it('gives access before the group starts; it waits', async () => {
    const res = await request(server())
      .post('/delegate-grant')
      .set(auth(delegate.token))
      .send({
        userId: helper.id,
        groupId: GROUP,
        permissions: ['GIVE_EXTRA', 'ADD_ATTEMPT', 'REORDER_ATTEMPTS'],
      })
      .expect(201);
    grantId = res.body.id;
    expect(res.body.activatedAt).toBeNull();

    const mine = await request(server())
      .get('/delegate-grant/mine')
      .set(auth(helper.token))
      .expect(200);
    expect(mine.body).toEqual([
      expect.objectContaining({ id: grantId, groupId: GROUP, active: false }),
    ]);

    const waiting = await incident(assigned, station);
    const refused = await resolve(helper.token, waiting).expect(403);
    expect(refused.body.message).toMatch(/starts when the group starts/);
    await db.attempt.delete({ where: { id: waiting.id } });
  });

  describe('while the group runs', () => {
    let assignedIncident: { id: string; resultId: string };
    let walkInIncident: { id: string; resultId: string };
    let outsiderIncident: { id: string; resultId: string };

    beforeAll(async () => {
      await setRoomGroups([GROUP]);
      assignedIncident = await incident(assigned, station);
      walkInIncident = await incident(walkIn, station);
      outsiderIncident = await incident(outsider, otherStation);
    });

    it('starts the access', async () => {
      const mine = await request(server())
        .get('/delegate-grant/mine')
        .set(auth(helper.token))
        .expect(200);
      expect(mine.body[0].active).toBe(true);
    });

    it('lists the incidents of competitors who solve in the group', async () => {
      const res = await request(server())
        .get('/incident/unresolved')
        .set(auth(helper.token))
        .expect(200);
      const ids = res.body.map((a: { id: string }) => a.id);
      expect(ids).toEqual(
        expect.arrayContaining([assignedIncident.id, walkInIncident.id]),
      );
      expect(ids).not.toContain(outsiderIncident.id);

      const count = await request(server())
        .get('/incident/unresolved/count')
        .set(auth(helper.token))
        .expect(200);
      expect(count.body.count).toBe(ids.length);
    });

    it('resolves an incident of a competitor assigned to another group', async () => {
      await resolve(helper.token, walkInIncident).expect(200);
      const attempt = await db.attempt.findUnique({
        where: { id: walkInIncident.id },
      });
      expect(attempt.status).toBe(AttemptStatus.RESOLVED);

      const actions = await request(server())
        .get(`/delegate-grant/${grantId}/actions`)
        .set(auth(delegate.token))
        .expect(200);
      expect(actions.body[0]).toMatchObject({
        kind: 'RESOLVE_INCIDENT',
        attemptId: walkInIncident.id,
        resultId: walkInIncident.resultId,
        summary: 'Resolved attempt 1: 12.34 → 14.34 (+2)',
      });
    });

    it('gives an extra on an incident', async () => {
      await resolve(helper.token, assignedIncident, {
        status: AttemptStatus.EXTRA_GIVEN,
        penalty: 0,
      }).expect(200);
    });

    it('refuses an incident in another room', async () => {
      const res = await resolve(helper.token, outsiderIncident).expect(403);
      expect(res.body.message).toMatch(/doesn't cover this competitor/);
    });

    it('refuses what the delegate did not tick', async () => {
      const other = await incident(assigned, station, 2);
      const res = await request(server())
        .delete(`/attempt/${other.id}`)
        .set(auth(helper.token))
        .expect(403);
      expect(res.body.message).toMatch(/doesn't include deleting attempts/);

      await request(server())
        .post('/attempt/dnf')
        .set(auth(helper.token))
        .send({ attemptIds: [], remainingInResultId: other.resultId })
        .expect(403);

      await request(server())
        .post('/attempt/give-extras-for-all')
        .set(auth(helper.token))
        .send({
          resultId: other.resultId,
          attemptIds: [other.id],
          useFreshSet: false,
          removeFromLive: false,
        })
        .expect(403);
    });

    it('adds an attempt for an assigned competitor', async () => {
      await request(server())
        .post('/attempt')
        .set(auth(helper.token))
        .send({
          attemptNumber: 3,
          value: 1500,
          penalty: 0,
          roundId: ROUND,
          competitorId: assigned.id,
          status: AttemptStatus.STANDARD,
          type: AttemptType.STANDARD_ATTEMPT,
        })
        .expect(201);
    });

    it('reads a covered result, but not past incidents', async () => {
      await request(server())
        .get(`/result/${walkInIncident.resultId}`)
        .set(auth(helper.token))
        .expect(200);
      await request(server())
        .get(`/result/${outsiderIncident.resultId}`)
        .set(auth(helper.token))
        .expect(403);
      const attempt = await request(server())
        .get(`/attempt/${walkInIncident.id}`)
        .set(auth(helper.token))
        .expect(200);
      expect(attempt.body.previousIncidents).toEqual([]);

      for (const path of [
        '/incident/resolved',
        '/incident/noteworthy',
        '/incident/warnings',
        '/incident/manual',
        `/incident/person/${walkIn.id}`,
        `/incident/round/${ROUND}`,
      ]) {
        await request(server()).get(path).set(auth(helper.token)).expect(403);
      }
    });

    it('never allows removing a result', async () => {
      await request(server())
        .post(`/result/${walkInIncident.resultId}/remove`)
        .set(auth(helper.token))
        .send({ reason: 'e2e' })
        .expect(403);
      await request(server())
        .post('/attempt/scorecard')
        .set(auth(helper.token))
        .send({})
        .expect(403);
    });

    it('allows a ticked bulk action', async () => {
      await request(server())
        .post('/delegate-grant')
        .set(auth(delegate.token))
        .send({ userId: helper.id, groupId: GROUP, permissions: ['DNF_ALL'] })
        .expect(201);
      // A result without an open incident, which a ruling waits for
      const target = await incident(walkIn, station, 2, AttemptStatus.STANDARD);
      await request(server())
        .post('/attempt/dnf')
        .set(auth(helper.token))
        .send({ attemptIds: [target.id] })
        .expect(200);
      // Changing the permissions kept the one grant
      expect(
        await db.delegateGrant.count({
          where: { userId: helper.id, endedAt: null },
        }),
      ).toBe(1);
    });
  });

  describe('when the group ends', () => {
    let later: { id: string };

    beforeAll(async () => {
      await setRoomGroups([NEXT_GROUP]);
      later = await incident(assigned, station, 5);
    });

    it('ends the access', async () => {
      const res = await resolve(helper.token, later).expect(403);
      expect(res.body.message).toMatch(/has ended/);
      const grant = await db.delegateGrant.findUnique({
        where: { id: grantId },
      });
      expect(grant.endedAt).not.toBeNull();
      await request(server())
        .get('/incident/unresolved')
        .set(auth(helper.token))
        .expect(403);
    });

    it('does not come back when the group starts again', async () => {
      await setRoomGroups([GROUP]);
      const res = await resolve(helper.token, later).expect(403);
      expect(res.body.message).toMatch(/has ended/);
    });

    it('covers incidents raised in the group before access was given', async () => {
      const before = await incident(walkIn, station, 8);
      await request(server())
        .post('/delegate-grant')
        .set(auth(delegate.token))
        .send({ userId: helper.id, groupId: GROUP, permissions: [] })
        .expect(201);
      const res = await request(server())
        .get('/incident/unresolved')
        .set(auth(helper.token))
        .expect(200);
      expect(res.body.map((a: { id: string }) => a.id)).toContain(before.id);
      await db.attempt.delete({ where: { id: before.id } });
    });

    it('ends a new access early when a delegate says so', async () => {
      const given = await request(server())
        .post('/delegate-grant')
        .set(auth(delegate.token))
        .send({ userId: helper.id, groupId: GROUP, permissions: [] })
        .expect(201);
      await resolve(helper.token, later, { attemptNumber: 5 }).expect(200);

      await request(server())
        .post(`/delegate-grant/${given.body.id}/end`)
        .set(auth(delegate.token))
        .expect(200);
      const another = await incident(assigned, station, 6);
      await resolve(helper.token, another, { attemptNumber: 6 }).expect(403);
    });

    it('never changed the user roles', async () => {
      const user = await db.user.findUnique({ where: { id: helper.id } });
      expect(user.roles).toEqual([Role.STAFF]);
    });
  });

  describe('socket.io', () => {
    let gateway: AppGateway;
    let url: string;
    const sockets: Socket[] = [];
    const connect = async (token: string) => {
      const socket = await connectSocketIo(url, token);
      sockets.push(socket);
      return socket;
    };

    beforeAll(async () => {
      gateway = app.get(AppGateway);
      url = await listenOnRandomPort(app);
      await setRoomGroups([GROUP]);
    });

    afterAll(() => sockets.forEach((socket) => socket.close()));

    it('tells the user and delegates when access is given, and shows what the user does', async () => {
      const helperSocket = await connect(helper.token);
      await joinRoom(
        gateway,
        helperSocket,
        'joinDelegateAccess',
        `user-${helper.id}`,
      );
      const delegateSocket = await connect(delegate.token);
      await joinRoom(
        gateway,
        delegateSocket,
        'joinDelegateGrants',
        'delegate-grants',
      );

      const changed = waitForEvent(helperSocket, 'delegateGrantChanged');
      const grantsChanged = waitForEvent(
        delegateSocket,
        'delegateGrantsChanged',
      );
      const given = await request(server())
        .post('/delegate-grant')
        .set(auth(delegate.token))
        .send({ userId: helper.id, groupId: GROUP, permissions: [] })
        .expect(201);
      await changed;
      await grantsChanged;

      // With access the user joins the incidents room
      await joinRoom(gateway, helperSocket, 'joinIncidents', 'incidents');

      const action = waitForEvent(delegateSocket, 'delegateGrantAction');
      const open = await incident(assigned, station, 7);
      await resolve(helper.token, open, { attemptNumber: 7 }).expect(200);
      expect(await action).toMatchObject({ grantId: given.body.id });
    });
  });
});
