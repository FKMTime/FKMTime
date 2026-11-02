import { INestApplication } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';

import { createTestApp } from './helpers/app.helper';
import { seededPersonPicker, WcifLike } from './helpers/seed.helper';
import { StationFixtures } from './helpers/station-fixtures.helper';
import { startStationSocketServer } from './helpers/station-socket.helper';

// Invented hardware ids and RFID card numbers, unique to this spec
const ESP = { station: 772001, unknown: 772099, requested: 772098 };
const CARD = { competitor: 7720010, judge: 7720011 };

describe('Station tester (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let adminToken: string;
  let fixtures: StationFixtures;
  let competitorId: string;
  let stationServer: Awaited<ReturnType<typeof startStationSocketServer>>;

  const send = (body: object, token: string | null = adminToken) => {
    const req = request(app.getHttpServer()).post('/station-tester/send');
    if (token) req.set('Authorization', `Bearer ${token}`);
    return req.send(body);
  };

  const inDevelopment = async <T>(run: () => Promise<T>) => {
    const previousEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      return await run();
    } finally {
      process.env.NODE_ENV = previousEnv;
    }
  };

  beforeAll(async () => {
    ({ app, db, adminToken } = await createTestApp());
    stationServer = await startStationSocketServer(app);
    fixtures = new StationFixtures(db, 'e2e-station-tester');
    await fixtures.purgeLeftovers(Object.values(CARD));
    await fixtures.disableResultSubmission();

    const room = await fixtures.createRoom('room', ['333-r1-g1']);
    await fixtures.createDevice('station', ESP.station, room.id);
    const competition = await db.competition.findFirst();
    const pick = seededPersonPicker(competition.wcif as unknown as WcifLike);
    const in333 = (p: WcifLike['persons'][number]) =>
      p.registration.eventIds.includes('333');
    competitorId = (
      await fixtures.giveCard(pick('in 333', in333), CARD.competitor)
    ).id;
    await fixtures.giveCard(pick('in 333', in333), CARD.judge);
  }, 30000);

  afterAll(async () => {
    await fixtures.cleanup();
    stationServer.destroyConnections();
    await new Promise((resolve) =>
      stationServer.socketServer.stop(() => resolve(null)),
    );
    await app.close();
  });

  it.each(['production', 'test'])(
    'does not exist when NODE_ENV is %s',
    async (env) => {
      const previousEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = env;
      try {
        await send({ type: 'ServerStatus', data: {} }).expect(404);
        await send({ type: 'ServerStatus', data: {} }, null).expect(404);
      } finally {
        process.env.NODE_ENV = previousEnv;
      }
    },
  );

  it('requires signing in', async () => {
    await inDevelopment(() =>
      send({ type: 'ServerStatus', data: {} }, null).expect(401),
    );
  });

  it('refuses a packet without a type', async () => {
    await inDevelopment(() => send({ data: {} }).expect(400));
  });

  it('answers with the packet sent and the reply to it', async () => {
    const data = { cardId: '7720001', espId: ESP.unknown, isCompetitor: true };

    const { body } = await inDevelopment(() =>
      send({ type: 'PersonInfo', data }).expect(200),
    );

    expect(body.sent).toEqual({
      type: 'PersonInfo',
      tag: expect.any(Number),
      data,
    });
    expect(body.reply).toMatchObject({
      type: 'Error',
      tag: body.sent.tag,
      data: { status: 404, error: true },
    });
  });

  it('enters an attempt the way a station does', async () => {
    const { body } = await inDevelopment(() =>
      send({
        type: 'EnterAttempt',
        data: {
          value: 1030,
          valueMs: 10305,
          penalty: 0,
          inspectionTime: 5000,
          solvedAt: new Date().toISOString(),
          espId: ESP.station,
          judgeId: CARD.judge,
          competitorId: CARD.competitor,
          isDelegate: false,
          sessionId: 'e2e-station-tester-session',
        },
      }).expect(200),
    );

    expect(body.reply).toMatchObject({
      type: 'EnterAttemptResp',
      tag: body.sent.tag,
      data: { status: 200, error: false },
    });
    const attempts = await db.attempt.findMany({
      where: { sessionId: 'e2e-station-tester-session' },
      include: { result: true },
    });
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      value: 1030,
      result: { personId: competitorId, roundId: '333-r1' },
    });
  });

  it('reaches the handlers a station reaches', async () => {
    const { body } = await inDevelopment(() =>
      send({
        type: 'RequestToConnectDevice',
        data: {
          espId: ESP.requested,
          signKey: 1,
          type: 'STATION',
          hw: 'v4',
        },
      }).expect(200),
    );

    expect(body.reply).toMatchObject({
      type: 'RequestToConnectDeviceResp',
      data: { status: 200, error: false },
    });
  });
});
