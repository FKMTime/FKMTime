import { INestApplication } from '@nestjs/common';
import { AttemptStatus, AttemptType, Person, Role } from '@prisma/client';
import { Socket } from 'socket.io-client';
import { AppGateway } from 'src/app.gateway';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';

import { createTestApp } from './helpers/app.helper';
import {
  connectSocketIo,
  isSocketInRoom,
  joinRoom,
  listenOnRandomPort,
  recordEvents,
  waitForEvent,
  waitForRoomMembership,
} from './helpers/socketio.helper';
import { StationFixtures } from './helpers/station-fixtures.helper';
import {
  startStationSocketServer,
  StationClient,
} from './helpers/station-socket.helper';

// Invented hardware ids and RFID card numbers, unique to this spec
const ESP = {
  station: 772001,
  runnerAttendance: 772002,
  requested: 772098,
};
const CARD = {
  competitor: 7720023,
  delegateCase: 7720017,
  judge: 7720018,
};
const GROUP = '333-r1-g2';

let sessionCounter = 0;
const newSession = () => `e2e-rt-gateway-session-${++sessionCounter}`;

describe('socket.io gateways (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let gateway: AppGateway;
  let url: string;
  let adminToken: string;
  let organizerToken: string;
  let delegateToken: string;
  let staffToken: string;
  let fixtures: StationFixtures;
  let stationServer: Awaited<ReturnType<typeof startStationSocketServer>>;
  let station: StationClient;
  let roomId: string;
  let competitor: Person;
  let delegateCase: Person;
  let judge: Person;
  const sockets: Socket[] = [];
  const adminTokenRef = () => adminToken;

  const connect = async (token?: string) => {
    const socket = await connectSocketIo(url, token);
    sockets.push(socket);
    return socket;
  };

  const enterAttempt = (overrides: Record<string, unknown> = {}) =>
    station.request('EnterAttempt', {
      value: 1111,
      valueMs: 11111,
      penalty: 0,
      inspectionTime: 7000,
      solvedAt: new Date().toISOString(),
      espId: ESP.station,
      judgeId: CARD.judge,
      competitorId: CARD.competitor,
      isDelegate: false,
      sessionId: newSession(),
      ...overrides,
    });

  /**
   * Emits arriving on one socket keep their order, so once the reply to a
   * later request is in, anything emitted before it has arrived too.
   */
  const flush = async (socket: Socket) => {
    const reply = waitForEvent(socket, 'currentStations');
    socket.emit('joinLiveSolving');
    await reply;
    socket.emit('leaveLiveSolving');
    await waitForRoomMembership(gateway, 'live-solving', socket, false);
  };

  beforeAll(async () => {
    ({ app, db, adminToken } = await createTestApp());
    url = await listenOnRandomPort(app);
    gateway = app.get(AppGateway, { strict: false });
    stationServer = await startStationSocketServer(app);
    fixtures = new StationFixtures(db, 'e2e-rt-gateway');
    await fixtures.purgeLeftovers(Object.values(CARD));
    await fixtures.disableResultSubmission();

    const room = await fixtures.createRoom('room', [GROUP]);
    roomId = room.id;
    await fixtures.createDevice('station', ESP.station, room.id);
    await fixtures.createDevice(
      'runner-att',
      ESP.runnerAttendance,
      room.id,
      'ATTENDANCE_RUNNER',
    );
    competitor = await fixtures.giveCard(23, CARD.competitor);
    delegateCase = await fixtures.giveCard(17, CARD.delegateCase);
    judge = await fixtures.giveCard(18, CARD.judge);

    organizerToken = await fixtures.createUserToken(app, 'organizer', [
      Role.ORGANIZER,
    ]);
    delegateToken = await fixtures.createUserToken(app, 'delegate', [
      Role.DELEGATE,
    ]);
    staffToken = await fixtures.createUserToken(app, 'staff', [Role.STAFF]);

    station = await StationClient.connect(stationServer.path);
    await station.waitForType('ServerStatus');
  }, 30000);

  afterAll(async () => {
    sockets.forEach((s) => s.close());
    station?.close();
    stationServer?.destroyConnections();
    await fixtures?.cleanup();
    await app.close();
  }, 30000);

  describe('public rooms', () => {
    it('accepts connections without a token', async () => {
      const socket = await connect();
      expect(socket.connected).toBe(true);
    });

    it('joins and leaves a round results room', async () => {
      const socket = await connect();

      await joinRoom(gateway, socket, 'joinResults', 'results-333-r1', {
        roundId: '333-r1',
      });
      socket.emit('leaveResults', { roundId: '333-r1' });
      await waitForRoomMembership(gateway, 'results-333-r1', socket, false);
    });

    it('joins live solving and gets the current stations right away', async () => {
      const socket = await connect();
      const stations = waitForEvent(socket, 'currentStations');

      socket.emit('joinLiveSolving');

      expect(Array.isArray(await stations)).toBe(true);
      expect(await isSocketInRoom(gateway, 'live-solving', socket)).toBe(true);
      socket.emit('leaveLiveSolving');
      await waitForRoomMembership(gateway, 'live-solving', socket, false);
    });
  });

  describe('protected rooms', () => {
    // every row has 4 entries: jest-each treats a shorter row as a done-callback test
    const protectedRooms: [string, string, string, unknown][] = [
      ['joinDevices', 'leaveDevices', 'device', undefined],
      ['joinCompetition', 'leaveCompetition', 'competition', undefined],
      ['joinStatistics', 'leaveStatistics', 'statistics', undefined],
      [
        'joinAttendance',
        'leaveAttendance',
        `attendance-${GROUP}`,
        { groupId: GROUP },
      ],
      ['joinIncidents', 'leaveIncidents', 'incidents', undefined],
    ];

    const expectRejected = async (
      socket: Socket,
      message: string,
      room: string,
      payload?: unknown,
    ) => {
      const exception = waitForEvent(socket, 'exception');
      if (payload === undefined) socket.emit(message);
      else socket.emit(message, payload);
      expect(await exception).toMatchObject({ status: 'error' });
      expect(await isSocketInRoom(gateway, room, socket)).toBe(false);
    };

    it.each(protectedRooms)(
      'rejects %s without a token',
      async (join, _leave, room, payload) => {
        const socket = await connect();
        await expectRejected(socket, join, room, payload);
      },
    );

    it.each(protectedRooms)(
      'rejects %s with an invalid token',
      async (join, _leave, room, payload) => {
        const socket = await connect('not-a-jwt');
        await expectRejected(socket, join, room, payload);
      },
    );

    it.each(protectedRooms)(
      'rejects %s for a staff member',
      async (join, _leave, room, payload) => {
        const socket = await connect(staffToken);
        await expectRejected(socket, join, room, payload);
      },
    );

    it.each(protectedRooms)(
      'lets an admin %s and leave again',
      async (join, leave, room, payload) => {
        const socket = await connect(adminToken);
        await joinRoom(gateway, socket, join, room, payload);
        if (payload === undefined) socket.emit(leave);
        else socket.emit(leave, payload);
        await waitForRoomMembership(gateway, room, socket, false);
      },
    );

    it.each(protectedRooms.filter(([join]) => join !== 'joinIncidents'))(
      'lets an organizer %s',
      async (join, _leave, room, payload) => {
        const socket = await connect(organizerToken);
        await joinRoom(gateway, socket, join, room, payload);
      },
    );

    it('keeps an organizer out of the incidents room', async () => {
      const socket = await connect(organizerToken);
      await expectRejected(socket, 'joinIncidents', 'incidents');
    });

    it('lets a delegate join the incidents and devices rooms', async () => {
      const socket = await connect(delegateToken);
      await joinRoom(gateway, socket, 'joinIncidents', 'incidents');
      await joinRoom(gateway, socket, 'joinDevices', 'device');
    });

    it('sends the pending device requests to whoever joins the devices room', async () => {
      const socket = await connect(organizerToken);
      const requests = waitForEvent(socket, 'deviceRequests');

      socket.emit('joinDevices');

      expect(await requests).toEqual(gateway.deviceRequests);
    });
  });

  describe('events caused by stations', () => {
    let observer: Socket;

    beforeAll(async () => {
      observer = await connect(adminToken);
      await joinRoom(gateway, observer, 'joinResults', 'results-333-r1', {
        roundId: '333-r1',
      });
      await joinRoom(gateway, observer, 'joinCompetition', 'competition');
      await joinRoom(
        gateway,
        observer,
        'joinAttendance',
        `attendance-${GROUP}`,
        { groupId: GROUP },
      );
      await joinRoom(gateway, observer, 'joinIncidents', 'incidents');
      await joinRoom(gateway, observer, 'joinDevices', 'device');
    });

    it('announces an attempt entered on a station to results, statistics and attendance viewers', async () => {
      const resultEntered = waitForEvent(observer, 'resultEntered');
      const statistics = waitForEvent(observer, 'statisticsUpdated');
      const competitorPresent = waitForEvent(
        observer,
        'newAttendance',
        (p: any) => p.competitorId === competitor.id,
      );
      const judgePresent = waitForEvent(
        observer,
        'newAttendance',
        (p: any) => p.competitorId === judge.id,
      );

      const res = await enterAttempt();

      expect(res.data.status).toBe(200);
      await resultEntered;
      await statistics;
      await competitorPresent;
      await judgePresent;
    });

    it('does not announce results to viewers of another round', async () => {
      const other = await connect();
      await joinRoom(gateway, other, 'joinResults', 'results-222-r1', {
        roundId: '222-r1',
      });
      const events = recordEvents(other, 'resultEntered');

      await enterAttempt();
      await flush(other);

      expect(events.received).toHaveLength(0);
      events.stop();
    });

    it('notifies the delegates when a station calls one', async () => {
      const incident = waitForEvent(observer, 'newIncident');

      const res = await enterAttempt({
        competitorId: CARD.delegateCase,
        isDelegate: true,
      });

      expect(res.data.status).toBe(200);
      const created = await db.attempt.findFirst({
        where: { result: { personId: delegateCase.id, roundId: '333-r1' } },
      });
      expect(await incident).toEqual({
        id: created.id,
        deviceName: 'e2e-rt-gateway-station',
        competitorName: delegateCase.name,
      });
    });

    it('points the delegate notification at the new unresolved attempt', async () => {
      const incident = waitForEvent(observer, 'newIncident');
      const data = { competitorId: CARD.competitor, isDelegate: true };

      await enterAttempt(data);

      const unresolved = await db.attempt.findFirst({
        where: {
          result: { personId: competitor.id, roundId: '333-r1' },
          status: AttemptStatus.UNRESOLVED,
        },
      });
      try {
        expect((await incident).id).toBe(unresolved.id);
      } finally {
        // Later tests enter the competitor's next attempt by number
        await db.attemptEditLog.deleteMany({
          where: { attemptId: unresolved.id },
        });
        await db.attempt.delete({ where: { id: unresolved.id } });
      }
    });

    it('shows a connection request from a new device to the devices room once', async () => {
      const shown = waitForEvent(observer, 'deviceRequests', (list: any[]) =>
        list.some((r) => r.espId === ESP.requested),
      );
      const payload = {
        espId: ESP.requested,
        signKey: ESP.requested,
        type: 'STATION',
        hw: 'V4',
      };

      await station.request('RequestToConnectDevice', payload);
      const list = await shown;
      await station.request('RequestToConnectDevice', payload);

      expect(list.filter((r: any) => r.espId === ESP.requested)).toEqual([
        payload,
      ]);
      expect(
        gateway.deviceRequests.filter((r) => r.espId === ESP.requested),
      ).toHaveLength(1);
    });

    it('tells the devices room when a station reports its battery', async () => {
      const updated = waitForEvent(observer, 'deviceUpdated');

      await station.request('UpdateBatteryPercentage', {
        espId: ESP.station,
        batteryPercentage: 77,
      });

      await updated;
    });

    it('announces attendance scanned on an attendance device', async () => {
      const present = waitForEvent(
        observer,
        'newAttendance',
        (p: any) => p.competitorId === judge.id,
      );

      await station.request('CreateAttendance', {
        cardId: CARD.judge,
        espId: ESP.runnerAttendance,
      });

      await present;
    });
  });

  describe('events caused by HTTP actions', () => {
    let observer: Socket;

    beforeAll(async () => {
      observer = await connect(adminToken);
      await joinRoom(gateway, observer, 'joinResults', 'results-333-r1', {
        roundId: '333-r1',
      });
      await joinRoom(gateway, observer, 'joinCompetition', 'competition');
      await joinRoom(gateway, observer, 'joinIncidents', 'incidents');
      await joinRoom(gateway, observer, 'joinDevices', 'device');
    });

    it('announces a manually entered attempt to the results room', async () => {
      const resultEntered = waitForEvent(observer, 'resultEntered');

      await request(app.getHttpServer())
        .post('/attempt')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          attemptNumber: 3,
          value: 2222,
          penalty: 0,
          roundId: '333-r1',
          competitorId: competitor.id,
          status: AttemptStatus.STANDARD,
          type: AttemptType.STANDARD_ATTEMPT,
        })
        .expect(201);

      await resultEntered;
    });

    it('announces an updated attempt to incidents and statistics viewers', async () => {
      const attemptUpdated = waitForEvent(observer, 'attemptUpdated');
      const statistics = waitForEvent(observer, 'statisticsUpdated');
      const unresolved = await db.attempt.findFirst({
        where: { result: { personId: delegateCase.id } },
      });

      await request(app.getHttpServer())
        .put(`/attempt/${unresolved.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          attemptNumber: unresolved.attemptNumber,
          status: AttemptStatus.RESOLVED,
          type: unresolved.type,
          penalty: 0,
          value: unresolved.value,
        })
        .expect(200);

      await attemptUpdated;
      await statistics;
    });

    it('removes the request and refreshes the stations when the requested device is added', async () => {
      const cleared = waitForEvent(
        observer,
        'deviceRequests',
        (list: any[]) => !list.some((r) => r.espId === ESP.requested),
      );

      const res = await request(app.getHttpServer())
        .post('/device')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'e2e-rt-gateway-requested',
          espId: ESP.requested,
          signKey: ESP.requested,
          roomId,
          type: 'STATION',
          hwVersion: 'V4',
        })
        .expect(201);

      await cleared;
      await station.waitFor(
        (m) =>
          m.type === 'ServerStatus' &&
          m.data.devices.some((d: any) => d.espId === ESP.requested),
      );

      const updated = waitForEvent(observer, 'deviceUpdated');
      await request(app.getHttpServer())
        .put(`/device/${res.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'e2e-rt-gateway-requested-renamed',
          espId: ESP.requested,
          roomId,
          type: 'STATION',
          hwVersion: 'V4',
        })
        .expect(200);
      await updated;

      const deleted = waitForEvent(observer, 'deviceUpdated');
      await request(app.getHttpServer())
        .delete(`/device/${res.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
      await deleted;
    });
  });

  describe('messages sent by clients', () => {
    let organizer: Socket;
    let delegate: Socket;

    beforeAll(async () => {
      organizer = await connect(organizerToken);
      await joinRoom(gateway, organizer, 'joinDevices', 'device');
      await joinRoom(gateway, organizer, 'joinCompetition', 'competition');
      delegate = await connect(delegateToken);
      await joinRoom(gateway, delegate, 'joinIncidents', 'incidents');
    });

    afterEach(() => {
      gateway.deviceRequests = gateway.deviceRequests.filter(
        (r) => r.espId !== ESP.requested,
      );
    });

    it('answers deviceRequests with the pending requests', async () => {
      const reply = waitForEvent(organizer, 'deviceRequests');
      organizer.emit('deviceRequests');
      expect(await reply).toEqual(gateway.deviceRequests);
    });

    it('drops a device request on removeDeviceRequest', async () => {
      gateway.deviceRequests.push({
        espId: ESP.requested,
        signKey: ESP.requested,
        type: 'STATION' as any,
        hw: 'V4',
      });
      const updated = waitForEvent(
        organizer,
        'deviceRequests',
        (list: any[]) => !list.some((r) => r.espId === ESP.requested),
      );

      organizer.emit('removeDeviceRequest', { espId: ESP.requested });

      await updated;
      expect(
        gateway.deviceRequests.some((r) => r.espId === ESP.requested),
      ).toBe(false);
    });

    it('does not let an anonymous client drop device requests', async () => {
      gateway.deviceRequests.push({
        espId: ESP.requested,
        signKey: ESP.requested,
        type: 'STATION' as any,
        hw: 'V4',
      });
      const anonymous = await connect();
      const exception = waitForEvent(anonymous, 'exception');

      anonymous.emit('removeDeviceRequest', { espId: ESP.requested });

      await exception;
      expect(
        gateway.deviceRequests.some((r) => r.espId === ESP.requested),
      ).toBe(true);
    });

    it('relays deviceUpdated from an organizer to the devices room', async () => {
      const relayed = waitForEvent(organizer, 'deviceUpdated');
      organizer.emit('deviceUpdated');
      await relayed;
    });

    it('does not relay deviceUpdated from an anonymous client', async () => {
      const anonymous = await connect();
      const events = recordEvents(organizer, 'deviceUpdated');
      const exception = waitForEvent(anonymous, 'exception');

      anonymous.emit('deviceUpdated');
      await exception;
      await flush(organizer);

      expect(events.received).toHaveLength(0);
      events.stop();
    });

    it('relays attemptUpdated from a delegate to incidents and statistics viewers', async () => {
      const attemptUpdated = waitForEvent(delegate, 'attemptUpdated');
      const statistics = waitForEvent(organizer, 'statisticsUpdated');

      delegate.emit('attemptUpdated');

      await attemptUpdated;
      await statistics;
    });

    it('does not relay attemptUpdated from an organizer', async () => {
      const events = recordEvents(delegate, 'attemptUpdated');
      const exception = waitForEvent(organizer, 'exception');

      organizer.emit('attemptUpdated');
      await exception;
      await flush(delegate);

      expect(events.received).toHaveLength(0);
      events.stop();
    });
  });

  describe('server-to-client events', () => {
    // resultEntered, groupShouldBeChanged and newIncident are only emitted
    // by the server; a client sending them must not reach anyone
    it.each([
      ['resultEntered', 'statisticsUpdated'],
      ['resultEntered', 'resultEntered'],
      ['groupShouldBeChanged', 'groupShouldBeChanged'],
      ['newIncident', 'newIncident'],
    ])(
      'ignores %s sent by a client (no %s relayed)',
      async (message, relayedEvent) => {
        const organizer = await connect(adminTokenRef());
        await joinRoom(gateway, organizer, 'joinCompetition', 'competition');
        await joinRoom(gateway, organizer, 'joinIncidents', 'incidents');
        await joinRoom(gateway, organizer, 'joinResults', 'results-333-r1', {
          roundId: '333-r1',
        });
        const relayed = recordEvents(organizer, relayedEvent);
        const anonymous = await connect();

        anonymous.emit(message, '333-r1');
        await flush(anonymous);
        await flush(organizer);

        expect(relayed.received).toHaveLength(0);
        relayed.stop();
      },
    );
  });

  describe('auto setup', () => {
    const autoSetupStatus = (value: boolean) => (m: any) =>
      m.type === 'ServerStatus' && m.data.autoSetup === value;

    it('ignores autosetup:start from an anonymous client', async () => {
      const anonymous = await connect();
      const exception = waitForEvent(anonymous, 'exception');

      anonymous.emit('autosetup:start');
      await exception;

      const status = await station.request('ServerStatus', {});
      expect(status.data.autoSetup).toBe(false);
    });

    it('switches auto setup on and off for the stations', async () => {
      const organizer = await connect(organizerToken);
      station.clear();

      organizer.emit('autosetup:start');
      await station.waitFor(autoSetupStatus(true));

      organizer.emit('autosetup:stop');
      await station.waitFor(autoSetupStatus(false));

      const status = await station.request('ServerStatus', {});
      expect(status.data.autoSetup).toBe(false);
    });
  });
});
