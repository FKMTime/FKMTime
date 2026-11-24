import { INestApplication } from '@nestjs/common';
import { DNF_VALUE } from 'src/constants';
import { DbService } from 'src/db/db.service';
import { StoredWcifService } from 'src/db/storedWcif.service';
import * as request from 'supertest';

import { Competition, Prisma } from '../src/generated/prisma/client';
import { found } from '../src/test-utils/found';
import { createTestApp } from './helpers/app.helper';
import { listenOnLoopback } from './helpers/loopback.helper';
import { seededPersonPicker, WcifLike } from './helpers/seed.helper';
import { StationFixtures } from './helpers/station-fixtures.helper';
import {
  startStationSocketServer,
  StationClient,
} from './helpers/station-socket.helper';

const PREFIX = 'e2e-stored-wcif';
const ROUND = '333-r1';
const UNOFFICIAL_ROUND = 'mirror-r1';
// Invented hardware id and RFID card numbers, unique to this spec
const ESP_ID = 783001;
const COMPETITOR_CARD = 7830001;
const JUDGE_CARD = 7830002;
/** The solve every attempt here sends: 10.00 s */
const SOLVE_CENTISECONDS = 1000;
/** A time limit the solve is over, and one it is well within */
const TIGHT_LIMIT = SOLVE_CENTISECONDS / 2;
const LOOSE_LIMIT = SOLVE_CENTISECONDS * 60;

type Round = { id: string; timeLimit: { centiseconds: number } | null };
type Wcif = WcifLike & { events: { id: string; rounds: Round[] }[] };

/** A copy of `wcif` with the round's time limit changed */
const withTimeLimit = (wcif: Wcif, roundId: string, centiseconds: number) => {
  const copy: Wcif = structuredClone(wcif);
  const round = found(
    copy.events.flatMap((e) => e.rounds).find((r) => r.id === roundId),
    `round ${roundId}`,
  );
  round.timeLimit = { centiseconds, cumulativeRoundIds: [] } as never;
  return copy;
};

const unofficialRound = (centiseconds: number) => ({
  id: UNOFFICIAL_ROUND,
  format: 'a',
  timeLimit: { centiseconds, cumulativeRoundIds: [] },
  cutoff: null,
  advancementCondition: null,
  results: [],
  scrambleSetCount: 1,
  extensions: [],
});

/**
 * The attempt path keeps the parsed WCIF between attempts. Whatever writes
 * the WCIF, the next attempt has to be checked against what was written.
 */
describe('The WCIF entering an attempt reads (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let adminToken: string;
  let fixtures: StationFixtures;
  let stationServer: Awaited<ReturnType<typeof startStationSocketServer>>;
  let connector: StationClient;
  let storedWcif: StoredWcifService;
  let original: Competition;
  let competitorId: string;
  let attempts = 0;

  const server = () => app.getHttpServer();
  const asAdmin = (req: request.Test) =>
    req.set('Authorization', `Bearer ${adminToken}`);
  const seededWcif = () => original.wcif as unknown as Wcif;

  /** Enters a 10.00 s solve and tells whether it was replaced by a DNF */
  const isEnteredAsDnf = async (groupId: string) => {
    const roundId = groupId.split('-g')[0];
    // A fresh result each time, so the round never runs out of attempts
    await db.result.deleteMany({ where: { personId: competitorId, roundId } });
    const sessionId = `${PREFIX}-${++attempts}`;
    const reply = await connector.request('EnterAttempt', {
      value: SOLVE_CENTISECONDS,
      valueMs: SOLVE_CENTISECONDS * 10,
      penalty: 0,
      inspectionTime: 8000,
      solvedAt: new Date().toISOString(),
      espId: ESP_ID,
      judgeId: JUDGE_CARD,
      competitorId: COMPETITOR_CARD,
      isDelegate: false,
      sessionId,
      groupId,
    });
    expect(reply.data).toMatchObject({ status: 200, error: false });
    const attempt = found(
      await db.attempt.findFirst({ where: { sessionId } }),
      `attempt ${sessionId}`,
    );
    return attempt.penalty === DNF_VALUE;
  };

  const writeWcif = (wcif: Wcif) =>
    db.competition.update({
      where: { id: original.id },
      data: { wcif: wcif as unknown as Prisma.InputJsonValue },
    });

  beforeAll(async () => {
    ({ app, db, adminToken } = await createTestApp());
    await listenOnLoopback(app);
    stationServer = await startStationSocketServer(app);
    storedWcif = app.get(StoredWcifService);
    fixtures = new StationFixtures(db, PREFIX);
    await fixtures.purgeLeftovers([COMPETITOR_CARD, JUDGE_CARD]);
    await db.unofficialEvent.deleteMany({ where: { eventId: 'mirror' } });
    await fixtures.disableResultSubmission();
    original = found(await db.competition.findFirst(), 'seeded competition');

    const pick = seededPersonPicker(seededWcif());
    const competitor = await fixtures.giveCard(
      pick('in 333', (p) => p.registration.eventIds.includes('333')),
      COMPETITOR_CARD,
    );
    competitorId = competitor.id;
    await fixtures.giveCard(
      pick('to judge', () => true),
      JUDGE_CARD,
    );
    const room = await fixtures.createRoom('room', [
      `${ROUND}-g1`,
      `${UNOFFICIAL_ROUND}-g1`,
    ]);
    await fixtures.createDevice('station', ESP_ID, room.id);
    connector = await StationClient.connect(stationServer.path);
  }, 60000);

  afterEach(async () => {
    // Every test starts from the competition row as it was: a sync also
    // rewrites columns other than the WCIF (the WCA's scoretaking software)
    await db.unofficialEvent.deleteMany({ where: { eventId: 'mirror' } });
    const row = { ...original, wcif: original.wcif as Prisma.InputJsonValue };
    await db.competition.upsert({
      where: { id: original.id },
      create: row,
      update: row,
    });
  });

  afterAll(async () => {
    connector?.close();
    stationServer?.destroyConnections();
    await fixtures?.cleanup();
    await app.close();
  }, 60000);

  it('parses the WCIF once until the competition row changes', async () => {
    const first = await storedWcif.get();

    expect(await storedWcif.get()).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first?.events[0].rounds[0])).toBe(true);

    await writeWcif(seededWcif());

    const afterWrite = await storedWcif.get();
    expect(afterWrite).not.toBe(first);
    expect(afterWrite).toEqual(first);
  });

  it('sees a time limit changed through the database client', async () => {
    expect(await isEnteredAsDnf(`${ROUND}-g1`)).toBe(false);

    await writeWcif(withTimeLimit(seededWcif(), ROUND, TIGHT_LIMIT));

    expect(await isEnteredAsDnf(`${ROUND}-g1`)).toBe(true);
  });

  it('sees a WCIF written by SQL from outside the backend', async () => {
    expect(await isEnteredAsDnf(`${ROUND}-g1`)).toBe(false);

    const tight = withTimeLimit(seededWcif(), ROUND, TIGHT_LIMIT);
    await db.$executeRaw`UPDATE competition SET wcif = ${JSON.stringify(tight)}::jsonb`;

    expect(await isEnteredAsDnf(`${ROUND}-g1`)).toBe(true);
  });

  it('sees the WCIF a sync with the WCA writes', async () => {
    await writeWcif(withTimeLimit(seededWcif(), ROUND, TIGHT_LIMIT));
    expect(await isEnteredAsDnf(`${ROUND}-g1`)).toBe(true);

    // The WCA's own time limit comes back
    await asAdmin(
      request(server()).get(`/competition/sync/${original.wcaId}`),
    ).expect(200);

    expect(await isEnteredAsDnf(`${ROUND}-g1`)).toBe(false);
  }, 30000);

  it('sees an unofficial event added and edited in the panel', async () => {
    await asAdmin(request(server()).post('/events'))
      .send({ eventId: 'mirror', rounds: [unofficialRound(LOOSE_LIMIT)] })
      .expect(201);
    expect(await isEnteredAsDnf(`${UNOFFICIAL_ROUND}-g1`)).toBe(false);
    const event = found(
      await db.unofficialEvent.findUnique({ where: { eventId: 'mirror' } }),
      'mirror event',
    );

    await asAdmin(request(server()).put(`/events/${event.id}`))
      .send({
        wcif: {
          id: 'mirror',
          rounds: [unofficialRound(TIGHT_LIMIT)],
          extensions: [],
          qualification: null,
        },
      })
      .expect(200);

    expect(await isEnteredAsDnf(`${UNOFFICIAL_ROUND}-g1`)).toBe(true);
  });

  it('sees a competition imported again, as a new row', async () => {
    expect(await isEnteredAsDnf(`${ROUND}-g1`)).toBe(false);

    // What an import leaves: the old row gone, a new one created
    await db.$transaction([
      db.competition.delete({ where: { id: original.id } }),
      db.competition.create({
        data: {
          ...original,
          wcif: withTimeLimit(
            seededWcif(),
            ROUND,
            TIGHT_LIMIT,
          ) as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);

    expect(await isEnteredAsDnf(`${ROUND}-g1`)).toBe(true);
  });
});
