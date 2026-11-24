import { INestApplication } from '@nestjs/common';
import { DbService } from 'src/db/db.service';

import { found } from '../src/test-utils/found';
import { createTestApp } from './helpers/app.helper';
import {
  seededPersonPicker,
  WcifLike,
  WcifPerson,
} from './helpers/seed.helper';
import { StationFixtures } from './helpers/station-fixtures.helper';
import {
  startStationSocketServer,
  StationClient,
} from './helpers/station-socket.helper';

/**
 * More stations than the database pool has connections (10 by default),
 * all finishing a solve at the same moment, as at the start of a round
 */
const STATIONS = 20;
const ROUND = '333-r1';

// Invented hardware ids and RFID card numbers, unique to this spec
const espIdOf = (i: number) => 782000 + i;
const competitorCardOf = (i: number) => 7820000 + i;
const judgeCardOf = (i: number) => 7821000 + i;

describe('Many stations entering attempts at once (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let fixtures: StationFixtures;
  let stationServer: Awaited<ReturnType<typeof startStationSocketServer>>;
  let connector: StationClient;
  const competitorIds: string[] = [];

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    stationServer = await startStationSocketServer(app);
    fixtures = new StationFixtures(db, 'e2e-enter-attempt-concurrency');
    const cards = Array.from({ length: STATIONS }, (_, i) => [
      competitorCardOf(i),
      judgeCardOf(i),
    ]).flat();
    await fixtures.purgeLeftovers(cards);
    await fixtures.disableResultSubmission();

    const competition = found(
      await db.competition.findFirst(),
      'seeded competition',
    );
    const wcif = competition.wcif as unknown as WcifLike;
    const pick = seededPersonPicker(wcif);
    const in333 = (p: WcifPerson) => p.registration.eventIds.includes('333');

    const room = await fixtures.createRoom('room', [`${ROUND}-g1`]);
    for (let i = 0; i < STATIONS; i++) {
      await fixtures.createDevice(`station-${i}`, espIdOf(i), room.id);
      const competitor = await fixtures.giveCard(
        pick(`in 333 for station ${i}`, in333),
        competitorCardOf(i),
      );
      competitorIds.push(competitor.id);
      await fixtures.giveCard(
        pick(`judging station ${i}`, () => true),
        judgeCardOf(i),
      );
    }

    // One micro-connector carries every station, as at a competition
    connector = await StationClient.connect(stationServer.path);
  }, 60000);

  afterAll(async () => {
    connector?.close();
    stationServer?.destroyConnections();
    await fixtures?.cleanup();
    await app.close();
  }, 60000);

  it('enters every solve without the requests waiting on each other', async () => {
    const startedAt = Date.now();
    const replies = await Promise.all(
      Array.from({ length: STATIONS }, (_, i) =>
        connector.request(
          'EnterAttempt',
          {
            value: 1000 + i,
            valueMs: 10000 + i * 10,
            penalty: 0,
            inspectionTime: 8000,
            solvedAt: new Date().toISOString(),
            espId: espIdOf(i),
            judgeId: judgeCardOf(i),
            competitorId: competitorCardOf(i),
            isDelegate: false,
            sessionId: `e2e-enter-attempt-concurrency-${i}`,
          },
          // Longer than the transaction's own 7.5 s timeout, so a deadlock
          // shows up as the error replies it causes, not as a missing reply
          15000,
        ),
      ),
    );
    const elapsedMs = Date.now() - startedAt;

    expect(replies.map((reply) => reply.data.status)).toEqual(
      Array(STATIONS).fill(200),
    );
    expect(elapsedMs).toBeLessThan(5000);
    expect(
      await db.attempt.count({
        where: {
          result: { personId: { in: competitorIds }, roundId: ROUND },
          sessionId: { startsWith: 'e2e-enter-attempt-concurrency-' },
        },
      }),
    ).toBe(STATIONS);
  }, 30000);
});
