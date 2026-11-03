import { INestApplication } from '@nestjs/common';
import { AttemptStatus, AttemptType, Person } from '@prisma/client';
import { Socket } from 'socket.io-client';
import { AppGateway, StationInfo } from 'src/app.gateway';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';

import { createTestApp } from './helpers/app.helper';
import {
  connectSocketIo,
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
  stationA: 773001,
  stationB: 773002,
  unregistered: 773099,
};
const CARD = {
  competitor: 7730010,
  judge: 7730012,
  unknown: 7730999,
};

describe('Live solving (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let gateway: AppGateway;
  let url: string;
  let adminToken: string;
  let fixtures: StationFixtures;
  let stationServer: Awaited<ReturnType<typeof startStationSocketServer>>;
  let station: StationClient;
  let viewer: Socket;
  let roomId: string;
  let competitor: Person;
  const sockets: Socket[] = [];

  const connect = async () => {
    const socket = await connectSocketIo(url);
    sockets.push(socket);
    return socket;
  };

  /** Joins live solving the way the public page does; resolves the snapshot */
  const joinLiveSolving = async (socket: Socket) => {
    const snapshot = waitForEvent<StationInfo[]>(socket, 'currentStations');
    socket.emit('joinLiveSolving');
    const stations = await snapshot;
    await waitForRoomMembership(gateway, 'live-solving', socket);
    return stations;
  };

  /** Sends a live packet from a station and resolves what viewers receive */
  const sendLivePacket = async (data: Record<string, unknown>) => {
    const received = waitForEvent<StationInfo>(
      viewer,
      'currentTimeInfo',
      (info) => info.espId === data.espId,
    );
    const ack = await station.request('CurrentTimeInfo', data);
    expect(ack).toMatchObject({ type: 'EmptyResp', data: { error: false } });
    return received;
  };

  beforeAll(async () => {
    ({ app, db, adminToken } = await createTestApp());
    url = await listenOnRandomPort(app);
    gateway = app.get(AppGateway, { strict: false });
    stationServer = await startStationSocketServer(app);
    fixtures = new StationFixtures(db, 'e2e-rt-live');
    await fixtures.purgeLeftovers(Object.values(CARD));
    await fixtures.disableResultSubmission();

    const room = await fixtures.createRoom('room', [
      '333-r1-g3',
      '333bf-r1-g2',
    ]);
    roomId = room.id;
    await fixtures.createDevice('station-a', ESP.stationA, room.id);
    await fixtures.createDevice('station-b', ESP.stationB, room.id);
    competitor = await fixtures.giveCard(10, CARD.competitor);
    await fixtures.giveCard(12, CARD.judge);

    station = await StationClient.connect(stationServer.path);
    await station.waitForType('ServerStatus');
    viewer = await connect();
  }, 30000);

  afterAll(async () => {
    sockets.forEach((s) => s.close());
    station?.close();
    stationServer?.destroyConnections();
    await fixtures?.cleanup();
    await app.close();
  }, 30000);

  it('lets an anonymous viewer join and get the stations seen so far', async () => {
    const stations = await joinLiveSolving(viewer);

    expect(Array.isArray(stations)).toBe(true);
    expect(stations.some((s) => s.espId === ESP.stationA)).toBe(false);
  });

  it('relays what a station shows, with the competitor and round', async () => {
    const info = await sendLivePacket({
      espId: ESP.stationA,
      time: 1234,
      inspection: 3000,
      competitor: CARD.competitor,
      groupId: '333-r1-g3',
    });

    expect(info).toEqual({
      espId: ESP.stationA,
      deviceName: 'e2e-rt-live-station-a',
      roomId,
      personName: competitor.name,
      registrantId: 10,
      groupId: '333-r1-g3',
      time: 1234,
      inspection: 3000,
      cumulativeLimitCentiseconds: null,
      cumulativeRemainingCentiseconds: null,
      serverReceivedAt: expect.any(Number),
    });
  });

  it('relays an idle packet from an unregistered station with placeholders', async () => {
    const info = await sendLivePacket({ espId: ESP.unregistered });

    expect(info).toEqual({
      espId: ESP.unregistered,
      deviceName: `Station ${ESP.unregistered}`,
      roomId: null,
      personName: null,
      registrantId: null,
      groupId: null,
      time: null,
      inspection: null,
      cumulativeLimitCentiseconds: null,
      cumulativeRemainingCentiseconds: null,
      serverReceivedAt: expect.any(Number),
    });
  });

  it('leaves the competitor empty when the card is unknown', async () => {
    const info = await sendLivePacket({
      espId: ESP.stationB,
      time: 10,
      competitor: CARD.unknown,
      groupId: '333-r1-g3',
    });

    expect(info).toMatchObject({
      deviceName: 'e2e-rt-live-station-b',
      personName: null,
      registrantId: null,
      groupId: '333-r1-g3',
      time: 10,
    });
  });

  describe('cumulative time limit (333bf-r1: 10:00.00 for the round)', () => {
    let resultId: string;

    const bldPacket = () =>
      sendLivePacket({
        espId: ESP.stationA,
        time: 500,
        competitor: CARD.competitor,
        groupId: '333bf-r1-g2',
      });

    const addAttempt = (attemptNumber: number, value: number) =>
      db.attempt.create({
        data: {
          resultId,
          attemptNumber,
          value,
          penalty: 0,
          status: AttemptStatus.STANDARD,
          type: AttemptType.STANDARD_ATTEMPT,
        },
      });

    beforeAll(async () => {
      const result = await db.result.create({
        data: {
          personId: competitor.id,
          roundId: '333bf-r1',
          eventId: '333bf',
        },
      });
      resultId = result.id;
    });

    it('reports the whole limit before any attempt', async () => {
      const info = await bldPacket();

      expect(info.cumulativeLimitCentiseconds).toBe(60000);
      expect(info.cumulativeRemainingCentiseconds).toBe(60000);
    });

    it('subtracts the submitted attempts', async () => {
      await addAttempt(1, 20000);

      const info = await bldPacket();

      expect(info.cumulativeRemainingCentiseconds).toBe(40000);
    });

    it('never goes below zero', async () => {
      await addAttempt(2, 50000);

      const info = await bldPacket();

      expect(info.cumulativeRemainingCentiseconds).toBe(0);
    });

    it('lists the round result on the public results endpoint without logging in', async () => {
      const res = await request(app.getHttpServer())
        .get('/result/public/round/333bf-r1')
        .query({ search: '10' })
        .expect(200);

      const result = res.body.find((r: any) => r.id === resultId);
      expect(result.person).toEqual(
        expect.objectContaining({ id: competitor.id, registrantId: 10 }),
      );
      expect(result.person).not.toHaveProperty('cardId');
      expect(result.attempts).toHaveLength(2);
    });
  });

  it('replays the latest packet of every station to a viewer who joins later', async () => {
    await sendLivePacket({ espId: ESP.stationB, time: 100 });
    await sendLivePacket({ espId: ESP.stationB, time: 200 });
    const late = await connect();

    const stations = await joinLiveSolving(late);

    const stationB = stations.filter((s) => s.espId === ESP.stationB);
    expect(stationB).toHaveLength(1);
    expect(stationB[0].time).toBe(200);
    expect(stations.map((s) => s.espId)).toEqual(
      expect.arrayContaining([ESP.stationA, ESP.unregistered]),
    );
  });

  it('stops sending packets to a viewer who left', async () => {
    const leaving = await connect();
    await joinLiveSolving(leaving);
    leaving.emit('leaveLiveSolving');
    await waitForRoomMembership(gateway, 'live-solving', leaving, false);
    const packets = recordEvents(leaving, 'currentTimeInfo');

    await sendLivePacket({ espId: ESP.stationA, time: 300 });
    // emits to one socket stay in order: once the reply to a later join is
    // in, a packet sent to it before would have arrived as well
    await joinLiveSolving(leaving);

    expect(packets.received).toHaveLength(0);
    packets.stop();
  });

  it('does not expose station sign keys on the public results endpoint', async () => {
    const entered = await station.request('EnterAttempt', {
      value: 1500,
      valueMs: 15000,
      penalty: 0,
      inspectionTime: 5000,
      solvedAt: new Date().toISOString(),
      espId: ESP.stationA,
      judgeId: CARD.judge,
      competitorId: CARD.competitor,
      groupId: '333-r1-g3',
      sessionId: 'e2e-rt-live-session-1',
    });
    expect(entered.data.status).toBe(200);

    const res = await request(app.getHttpServer())
      .get('/result/public/round/333-r1')
      .expect(200);

    const result = res.body.find((r: any) => r.person.id === competitor.id);
    expect(result.attempts[0].device).not.toHaveProperty('signKey');
  });

  describe('public competition endpoints used by the live pages', () => {
    it('returns the competition without logging in, without secrets', async () => {
      const res = await request(app.getHttpServer())
        .get('/competition/public')
        .expect(200);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        wcif: expect.any(Object),
      });
      for (const secret of [
        'scoretakingToken',
        'cubingContestsToken',
        'fkmToken',
        'wifiPassword',
      ]) {
        expect(res.body).not.toHaveProperty(secret);
      }
    });

    it('returns the rooms with their current groups without logging in', async () => {
      const res = await request(app.getHttpServer())
        .get('/competition/public/rooms')
        .expect(200);

      expect(res.body).toContainEqual(
        expect.objectContaining({
          id: roomId,
          currentGroupIds: ['333-r1-g3', '333bf-r1-g2'],
        }),
      );
    });

    it('still serves the authenticated competition info to logged-in users', async () => {
      await request(app.getHttpServer())
        .get('/competition')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });
});
