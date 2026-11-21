import { INestApplication } from '@nestjs/common';
import { Socket } from 'socket.io-client';
import { AppGateway } from 'src/app.gateway';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';

import { Prisma, Role, Room } from '../src/generated/prisma/client';
import { createTestApp } from './helpers/app.helper';
import {
  createUserWithRoles,
  deleteSetupUsers,
} from './helpers/setup-roles.helper';
import {
  connectSocketIo,
  joinRoom,
  listenOnRandomPort,
  recordEvents,
  waitForEvent,
} from './helpers/socketio.helper';
import { StationFixtures } from './helpers/station-fixtures.helper';

/**
 * SPEC-015: delegates hear about a group every WCIF delegate competes in, so
 * they can give someone delegate access for it before it starts.
 */
const PREFIX = 'e2e-delegate-coverage';
const ROUND = '444-r1';
const GROUP_1 = `${ROUND}-g1`;
const GROUP_2 = `${ROUND}-g2`;
const USER_SUFFIX = 'delegate-coverage';

describe('Groups with no free delegate (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let adminToken: string;
  let fixtures: StationFixtures;
  let delegate: { id: string; token: string };
  let helper: { id: string; token: string };
  let room: Room;
  let originalWcif: Prisma.JsonValue;
  let roomsBefore: { id: string; currentGroupIds: string[] }[];
  let gateway: AppGateway;
  let url: string;
  const sockets: Socket[] = [];

  const server = () => app.getHttpServer();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const setRoomGroups = (groupIds: string[]) =>
    request(server())
      .put('/competition/rooms')
      .set(auth(adminToken))
      .send({ rooms: [{ id: room.id, currentGroupIds: groupIds }] })
      .expect(200);

  const uncoveredGroups = (token: string) =>
    request(server()).get('/delegate-grant/uncovered-groups').set(auth(token));

  beforeAll(async () => {
    ({ app, db, adminToken } = await createTestApp());
    fixtures = new StationFixtures(db, PREFIX);
    await fixtures.purgeLeftovers([]);
    await db.delegateGrant.deleteMany({
      where: { groupId: { in: [GROUP_1, GROUP_2] } },
    });
    await deleteSetupUsers(db, USER_SUFFIX);
    delegate = await createUserWithRoles(app, db, `delegate-${USER_SUFFIX}`, [
      Role.DELEGATE,
    ]);
    helper = await createUserWithRoles(app, db, `helper-${USER_SUFFIX}`, [
      Role.STAFF,
    ]);

    roomsBefore = await db.room.findMany({
      select: { id: true, currentGroupIds: true },
    });
    await db.room.updateMany({ data: { currentGroupIds: [] } });
    room = await fixtures.createRoom('main', []);

    // A room of this spec's own in the schedule, and two delegates, both
    // competing in its second group. Nobody else is a delegate.
    const competition = await db.competition.findFirst();
    originalWcif = competition.wcif;
    const wcif = competition.wcif as unknown as {
      persons: { roles?: string[] }[];
      schedule: { venues: { rooms: unknown[] }[] };
    };
    const start = new Date();
    start.setHours(10, 0, 0, 0);
    const at = (minutes: number) =>
      new Date(start.getTime() + minutes * 60_000).toISOString();
    const delegatePerson = (name: string, registrantId: number) => ({
      name,
      registrantId,
      wcaUserId: registrantId,
      roles: ['delegate'],
      assignments: [{ activityId: 990012, assignmentCode: 'competitor' }],
    });
    await db.competition.update({
      where: { id: competition.id },
      data: {
        wcif: {
          ...wcif,
          persons: [
            ...wcif.persons.map((person) => ({
              ...person,
              roles: (person.roles ?? []).filter(
                (role) => role !== 'delegate' && role !== 'trainee-delegate',
              ),
            })),
            delegatePerson('Coverage Delegate One', 990001),
            delegatePerson('Coverage Delegate Two', 990002),
          ],
          schedule: {
            ...wcif.schedule,
            venues: wcif.schedule.venues.map((venue, index) =>
              index === 0
                ? {
                    ...venue,
                    rooms: [
                      ...venue.rooms,
                      {
                        id: 990000,
                        name: room.name,
                        activities: [
                          {
                            id: 990010,
                            activityCode: ROUND,
                            startTime: at(0),
                            endTime: at(60),
                            childActivities: [
                              {
                                id: 990011,
                                activityCode: GROUP_1,
                                startTime: at(0),
                                endTime: at(30),
                                childActivities: [],
                              },
                              {
                                id: 990012,
                                activityCode: GROUP_2,
                                startTime: at(30),
                                endTime: at(60),
                                childActivities: [],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  }
                : venue,
            ),
          },
        } as unknown as Prisma.InputJsonValue,
      },
    });

    gateway = app.get(AppGateway);
    url = await listenOnRandomPort(app);
  }, 30000);

  afterAll(async () => {
    try {
      sockets.forEach((socket) => socket.close());
      await db.delegateGrant.deleteMany({
        where: { groupId: { in: [GROUP_1, GROUP_2] } },
      });
      const competition = await db.competition.findFirst();
      await db.competition.update({
        where: { id: competition.id },
        data: { wcif: originalWcif as Prisma.InputJsonValue },
      });
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

  it('tells delegates when the group every delegate competes in is next', async () => {
    const socket = await connectSocketIo(url, delegate.token);
    sockets.push(socket);
    await joinRoom(gateway, socket, 'joinDelegateGrants', 'delegate-grants');
    const announced = waitForEvent<{ groups: { groupId: string }[] }>(
      socket,
      'noFreeDelegate',
    );

    await setRoomGroups([GROUP_1]);

    const { groups } = await announced;
    expect(groups).toEqual([
      expect.objectContaining({
        groupId: GROUP_2,
        running: false,
        roomNames: [room.name],
        competingDelegates: ['Coverage Delegate One', 'Coverage Delegate Two'],
      }),
    ]);
  });

  it('tells them only once about a group', async () => {
    const socket = await connectSocketIo(url, delegate.token);
    sockets.push(socket);
    await joinRoom(gateway, socket, 'joinDelegateGrants', 'delegate-grants');
    const events = recordEvents(socket, 'noFreeDelegate');

    await setRoomGroups([GROUP_2]);
    // The rooms change goes out after the announcement would have
    await new Promise((resolve) => setTimeout(resolve, 300));

    events.stop();
    expect(events.received).toEqual([]);
  });

  it('lists the group on Home for delegates only', async () => {
    await uncoveredGroups(helper.token).expect(403);
    const { body } = await uncoveredGroups(delegate.token).expect(200);
    expect(body).toEqual([
      expect.objectContaining({ groupId: GROUP_2, running: true }),
    ]);
  });

  it('drops the group once someone has delegate access for it', async () => {
    await request(server())
      .post('/delegate-grant')
      .set(auth(delegate.token))
      .send({ userId: helper.id, groupId: GROUP_2, permissions: [] })
      .expect(201);
    const { body } = await uncoveredGroups(delegate.token).expect(200);
    expect(body).toEqual([]);
  });
});
