import { INestApplication } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import { getAllTranslations } from 'src/translations/translations';

import { Person, Prisma } from '../src/generated/prisma/client';
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

// Invented hardware ids and RFID card numbers, unique to this spec
const ESP_STATION = 781001;
const CARD = { competitor: 7810010, judge: 7810011 };

/** The seeded competition's last 333 round, run as head-to-head here */
const H2H_ROUND = '333-r3';

describe('Stations in a head-to-head round (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let fixtures: StationFixtures;
  let stationServer: Awaited<ReturnType<typeof startStationSocketServer>>;
  let station: StationClient;
  let competitor: Person;
  let originalWcif: Prisma.JsonValue;

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    stationServer = await startStationSocketServer(app);
    fixtures = new StationFixtures(db, 'e2e-h2h-station');
    await fixtures.purgeLeftovers(Object.values(CARD));
    await fixtures.disableResultSubmission();

    const competition = found(
      await db.competition.findFirst(),
      'seeded competition',
    );
    originalWcif = competition.wcif;
    const wcif = competition.wcif as unknown as WcifLike & {
      events: { id: string; rounds: { id: string; format: string }[] }[];
    };
    await db.competition.update({
      where: { id: competition.id },
      data: {
        wcif: {
          ...wcif,
          events: wcif.events.map((event) => ({
            ...event,
            rounds: event.rounds.map((round) =>
              round.id === H2H_ROUND ? { ...round, format: 'h' } : round,
            ),
          })),
        } as unknown as Prisma.InputJsonValue,
      },
    });

    const room = await fixtures.createRoom('room', [`${H2H_ROUND}-g1`]);
    await fixtures.createDevice('station', ESP_STATION, room.id);
    const pick = seededPersonPicker(wcif);
    const in333 = (p: WcifPerson) => p.registration.eventIds.includes('333');
    competitor = await fixtures.giveCard(
      pick('in 333', in333),
      CARD.competitor,
    );
    await fixtures.giveCard(pick('a judge', in333), CARD.judge);

    station = await StationClient.connect(stationServer.path);
  }, 30000);

  afterAll(async () => {
    station?.close();
    stationServer?.destroyConnections();
    const competition = found(
      await db.competition.findFirst(),
      'seeded competition',
    );
    await db.competition.update({
      where: { id: competition.id },
      data: { wcif: originalWcif as Prisma.InputJsonValue },
    });
    await fixtures?.cleanup();
    await app.close();
  }, 30000);

  it('refuses a solve and saves nothing until stations can run matches', async () => {
    const reply = await station.request('EnterAttempt', {
      value: 1234,
      valueMs: 12345,
      penalty: 0,
      inspectionTime: 8000,
      solvedAt: new Date().toISOString(),
      espId: ESP_STATION,
      judgeId: CARD.judge,
      competitorId: CARD.competitor,
      isDelegate: false,
      sessionId: 'e2e-h2h-station-session-1',
    });

    // In the language of whoever reads the station
    const messages = getAllTranslations().map(
      (locale) =>
        locale.translations.find((t) => t.key === 'h2hRoundNotOnStations')
          .translation,
    );
    expect(reply).toMatchObject({
      type: 'Error',
      data: { status: 400, error: true },
    });
    expect(messages).toContain(reply.data.message);
    expect(
      await db.attempt.count({
        where: { result: { personId: competitor.id, roundId: H2H_ROUND } },
      }),
    ).toBe(0);
  });
});
