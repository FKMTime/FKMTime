import { INestApplication } from '@nestjs/common';
import { sha512 } from 'js-sha512';
import { DbService } from 'src/db/db.service';
import { getReaderLocale } from 'src/result/helpers';
import { getTranslation } from 'src/translations/translations';
import * as request from 'supertest';
import { Competition } from 'wcif-helpers';

import { disconnectSeedDb, seedH2hBracket } from '../prisma/seed/seed-test';
import {
  AttemptStatus,
  AttemptType,
  Person,
  Prisma,
} from '../src/generated/prisma/client';
import { found } from '../src/test-utils/found';
import { createTestApp } from './helpers/app.helper';
import {
  createRoleUsers,
  deleteSetupUsers,
  TestUser,
} from './helpers/setup-roles.helper';
import { StationFixtures } from './helpers/station-fixtures.helper';
import {
  startStationSocketServer,
  StationClient,
} from './helpers/station-socket.helper';

const SUFFIX = 'h2h-station';

// Invented hardware ids and RFID card numbers, unique to this spec
const ESP = { a: 781001, b: 781002, otherRound: 781003, bothRounds: 781004 };
const CARD = {
  seed1: 7810011,
  seed2: 7810012,
  seed3: 7810013,
  seed4: 7810014,
  judge: 7810019,
};
const SCRAMBLING_TOKEN = 'e2e-h2h-station-scrambling-token';

interface AttemptView {
  id: string;
  attemptNumber: number;
  value: number;
  penalty: number;
  status: string;
}

interface PointView {
  id: string;
  pointNumber: number;
  winnerSide: 'A' | 'B' | null;
  decided: boolean;
  attemptA: AttemptView | null;
  attemptB: AttemptView | null;
  amendedAfterMatch: boolean;
}

interface MatchView {
  id: string;
  matchNumber: number;
  status: string;
  winnerSide: 'A' | 'B' | null;
  sideA: { entrantId: string | null };
  sideB: { entrantId: string | null };
  sets: {
    setNumber: number;
    winnerSide: 'A' | 'B' | null;
    points: PointView[];
  }[];
}

interface View {
  bracket: {
    entrants: { id: string; person: { id: string } }[];
    matches: MatchView[];
  };
}

/** Sets of 5 scrambles and 2 extras */
const scrambleSet = (roundId: string, set: string) => ({
  roundId,
  set,
  scrambles: [
    ...Array.from({ length: 5 }, (_, i) => ({
      num: i + 1,
      encryptedScramble: `encrypted-${set}-${i + 1}`,
      isExtra: false,
    })),
    ...Array.from({ length: 2 }, (_, i) => ({
      num: i + 1,
      encryptedScramble: `encrypted-${set}-e${i + 1}`,
      isExtra: true,
    })),
  ],
});

/**
 * Two stations run a head-to-head match: each competitor's judge submits
 * attempts as usual, and the backend groups them into points, sets and the
 * match (SPEC-001, Running a match on competition day)
 */
describe('Stations in a head-to-head round (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let fixtures: StationFixtures;
  let stationServer: Awaited<ReturnType<typeof startStationSocketServer>>;
  let station: StationClient;
  let users: Record<'DELEGATE' | 'STAGE_LEADER' | 'STAFF', TestUser>;
  let originalWcif: Prisma.JsonValue;
  let defaultLocale: string;
  let roundId: string;
  let groupId: string;
  /** Seeds 1 to 4: semifinal 1 is seed 1 (A) against seed 4 (B) */
  let seeds: Person[];
  let judge: Person;
  let session = 0;

  const server = () => app.getHttpServer();
  const as = (user: TestUser) => ({ Authorization: `Bearer ${user.token}` });
  const getView = async () =>
    (
      await request(server())
        .get(`/h2h/${roundId}`)
        .set(as(users.STAFF))
        .expect(200)
    ).body as View;
  const matchOf = (view: View, matchNumber: number) =>
    found(
      view.bracket.matches.find((m) => m.matchNumber === matchNumber),
      `match ${matchNumber}`,
    );
  const start = async (matchNumber: number) =>
    request(server())
      .post(`/h2h/match/${matchOf(await getView(), matchNumber).id}/start`)
      .set(as(users.STAGE_LEADER))
      .expect(200);
  const cardOf = (person: Person) => Number(found(person.cardId, 'card'));
  /** A solve sent from a station, as the connector sends it */
  const solveData = (
    person: Person,
    value: number,
    extra: Record<string, unknown> = {},
  ) => ({
    value,
    valueMs: value * 10,
    penalty: 0,
    inspectionTime: 0,
    solvedAt: new Date().toISOString(),
    espId: ESP.a,
    judgeId: CARD.judge,
    competitorId: cardOf(person),
    isDelegate: false,
    sessionId: `e2e-h2h-station-${++session}`,
    groupId,
    ...extra,
  });
  const solve = (
    person: Person,
    value: number,
    extra: Record<string, unknown> = {},
  ) => station.request('EnterAttempt', solveData(person, value, extra));
  /** The texts the competitor's station shows, in their reader's language */
  const textsFor = (person: Person) => {
    const locale = getReaderLocale(person, judge, defaultLocale);
    const t = (key: string) => getTranslation(key, locale);
    return {
      t,
      score: (set: string, sets: string) =>
        t('h2hScore').replace('{0}', set).replace('{1}', sets),
    };
  };
  const attemptsOf = (person: Person) =>
    db.attempt.findMany({
      where: { result: { personId: person.id, roundId } },
      orderBy: { attemptNumber: 'asc' },
    });
  const ok = (message: string) =>
    expect.objectContaining({
      type: 'EnterAttemptResp',
      data: expect.objectContaining({
        message,
        status: 200,
        error: false,
        shouldResetTime: true,
      }),
    });
  /**
   * Refused with nothing saved. The station keeps the time only of a solve
   * a point ahead, to send again once the opponent catches up.
   */
  const refused = (message: string, shouldResetTime = true) =>
    expect.objectContaining({
      type: 'Error',
      data: expect.objectContaining({
        message,
        status: 409,
        error: true,
        shouldResetTime,
      }),
    });
  const scan = (person: Person, espId = ESP.a) =>
    station.request('PersonInfo', {
      cardId: person.cardId,
      espId,
      isCompetitor: true,
    });
  const scanRefused = (
    person: Person,
    key: string,
    shouldResetTime: boolean,
  ) => ({
    type: 'Error',
    data: {
      message: getTranslation(key, person.countryIso2 ?? defaultLocale),
      status: 400,
      error: true,
      shouldResetTime,
    },
  });

  const clean = async () => {
    // Points hold their attempts and scrambles, so the bracket goes first
    await db.h2hBracket.deleteMany();
    await db.result.deleteMany({ where: { roundId } });
    await db.scrambleSet.deleteMany({ where: { roundId } });
  };

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    stationServer = await startStationSocketServer(app);
    await deleteSetupUsers(db, SUFFIX);
    users = await createRoleUsers(app, db, SUFFIX);
    const competition = found(
      await db.competition.findFirst(),
      'seeded competition',
    );
    originalWcif = competition.wcif;
    defaultLocale = competition.defaultLocale ?? 'en';
    const wcif = competition.wcif as unknown as Competition;
    roundId = found(
      wcif.events.flatMap((e) => e.rounds).find((r) => r.format === 'h'),
      'a head-to-head round in the dummy WCA competition',
    ).id;
    groupId = `${roundId}-g1`;
    await clean();
    await db.scramblingDevice.deleteMany({
      where: { name: 'e2e-h2h-station-scrambler' },
    });

    fixtures = new StationFixtures(db, 'e2e-h2h-station');
    await fixtures.purgeLeftovers(Object.values(CARD));
    await fixtures.disableResultSubmission();
    const eventId = roundId.split('-r')[0];
    const registrantIds = wcif.persons
      .filter(
        (p) =>
          p.registration?.status === 'accepted' &&
          p.registration.eventIds.includes(eventId as never),
      )
      .map((p) => p.registrantId)
      .sort((x, y) => x - y);
    expect(registrantIds.length).toBeGreaterThanOrEqual(5);
    seeds = [];
    for (const [i, card] of [
      CARD.seed1,
      CARD.seed2,
      CARD.seed3,
      CARD.seed4,
    ].entries()) {
      seeds.push(await fixtures.giveCard(registrantIds[i], card));
    }
    judge = await fixtures.giveCard(registrantIds[4], CARD.judge);

    const room = await fixtures.createRoom('room', [groupId]);
    await fixtures.createDevice('station-a', ESP.a, room.id);
    await fixtures.createDevice('station-b', ESP.b, room.id);
    // The event's earlier round, running in another room
    const otherRoom = await fixtures.createRoom('other-room', [
      `${eventId}-r1-g1`,
    ]);
    await fixtures.createDevice('station-other', ESP.otherRound, otherRoom.id);
    await db.scramblingDevice.create({
      data: {
        name: 'e2e-h2h-station-scrambler',
        encryptedToken: sha512(SCRAMBLING_TOKEN),
        room: { connect: { id: room.id } },
      },
    });

    station = await StationClient.connect(stationServer.path);
  }, 30000);

  beforeEach(async () => {
    await clean();
    await request(server())
      .post(`/h2h/${roundId}`)
      .set(as(users.DELEGATE))
      .send({ size: 4, setsToWin: {} })
      .expect(201);
    await request(server())
      .put(`/h2h/${roundId}/seeds`)
      .set(as(users.DELEGATE))
      .send({ personIds: seeds.map((p) => p.id) })
      .expect(200);
    await request(server())
      .post('/scramble-set/import')
      .set(as(users.DELEGATE))
      .send({
        scrambleSets: ['A', 'B', 'C', 'D'].map((set) =>
          scrambleSet(roundId, set),
        ),
      })
      .expect(201);
  });

  afterAll(async () => {
    station?.close();
    stationServer?.destroyConnections();
    await clean();
    await db.scramblingDevice.deleteMany({
      where: { name: 'e2e-h2h-station-scrambler' },
    });
    await fixtures?.cleanup();
    // Leave the bracket the seed gives, for whatever runs next
    await seedH2hBracket(originalWcif as unknown as Competition);
    await disconnectSeedDb();
    await deleteSetupUsers(db, SUFFIX);
    await app.close();
  }, 30000);

  it("puts two stations' solves into one point, decides it and moves the match on", async () => {
    const [seed1, , , seed4] = seeds;
    const a = textsFor(seed1);
    const b = textsFor(seed4);
    await start(1);

    expect(await solve(seed1, 1000)).toEqual(ok(a.t('h2hWaitingForOpponent')));
    expect(await solve(seed4, 1100, { espId: ESP.b })).toEqual(
      ok(`${b.t('h2hPointLost')} ${b.score('0-1', '0-0')}`),
    );
    const afterOne = matchOf(await getView(), 1);
    expect(afterOne.sets).toHaveLength(1);
    expect(afterOne.sets[0].points).toHaveLength(1);
    expect(afterOne.sets[0].points[0]).toMatchObject({
      winnerSide: 'A',
      decided: true,
      attemptA: { value: 1000 },
      attemptB: { value: 1100 },
    });

    expect(await solve(seed4, 1200, { espId: ESP.b })).toEqual(
      ok(b.t('h2hWaitingForOpponent')),
    );
    expect(await solve(seed1, 1000)).toEqual(
      ok(`${a.t('h2hPointWon')} ${a.score('2-0', '0-0')}`),
    );
    await solve(seed1, 1000);
    expect(await solve(seed4, 1300, { espId: ESP.b })).toEqual(
      ok(`${b.t('h2hMatchLost')} ${b.score('0-3', '0-1')}`),
    );

    const view = await getView();
    const semi = matchOf(view, 1);
    expect(semi).toMatchObject({ status: 'FINISHED', winnerSide: 'A' });
    expect(semi.sets[0].points.map((p) => p.winnerSide)).toEqual([
      'A',
      'A',
      'A',
    ]);
    const entrantOf = (person: Person) =>
      found(
        view.bracket.entrants.find((e) => e.person.id === person.id),
        'entrant',
      ).id;
    // The final takes the winner, the third-place match the loser
    expect(matchOf(view, 4).sideA.entrantId).toBe(entrantOf(seed1));
    const thirdPlace = matchOf(view, 3);
    expect([thirdPlace.sideA.entrantId, thirdPlace.sideB.entrantId]).toContain(
      entrantOf(seed4),
    );
    expect((await attemptsOf(seed1)).map((x) => x.attemptNumber)).toEqual([
      1, 2, 3,
    ]);
  });

  it('says the match is won to the one whose solve ends it', async () => {
    const [seed1, , , seed4] = seeds;
    const a = textsFor(seed1);
    await start(1);
    for (let i = 0; i < 2; i++) {
      await solve(seed1, 1000);
      await solve(seed4, 1100, { espId: ESP.b });
    }
    await solve(seed4, 1100, { espId: ESP.b });

    expect(await solve(seed1, 1000)).toEqual(
      ok(`${a.t('h2hMatchWon')} ${a.score('3-0', '1-0')}`),
    );
  });

  it('refuses a solve that would put a competitor two points ahead, and saves nothing', async () => {
    const [seed1, , , seed4] = seeds;
    const b = textsFor(seed4);
    await start(1);
    await solve(seed1, 1000);
    // Equal times: nobody wins the point (I3d)
    expect(await solve(seed4, 1000, { espId: ESP.b })).toEqual(
      ok(`${b.t('h2hNoPoint')} ${b.score('0-0', '0-0')}`),
    );
    await solve(seed1, 1200);

    const reply = await solve(seed1, 1300);

    // Raced on point 3, which waits for the opponent: the judge sends it again
    expect(reply).toEqual(
      refused(textsFor(seed1).t('h2hWaitingForOpponent'), false),
    );
    expect(await attemptsOf(seed1)).toHaveLength(2);
    const points = matchOf(await getView(), 1).sets[0].points;
    expect(points).toHaveLength(2);
    expect(points[1].attemptA?.value).toBe(1200);
    expect(points[1].attemptB).toBeNull();
  });

  it('answers a resent solve as entered and fills no second slot', async () => {
    const [seed1, , , seed4] = seeds;
    await start(1);
    await solve(seed1, 1000);
    // Both are in on point 1: entered again, B's would open point 2
    const data = solveData(seed4, 1100, { espId: ESP.b });
    await station.request('EnterAttempt', data);

    const resent = await station.request('EnterAttempt', data);

    expect(resent).toMatchObject({
      type: 'Error',
      data: {
        // Answered before the judge card is read, in the competition's
        // language, as for any round
        message: getTranslation('attemptAlreadyEntered', defaultLocale),
        status: 409,
        error: true,
      },
    });
    expect(await attemptsOf(seed4)).toHaveLength(1);
    const points = matchOf(await getView(), 1).sets[0].points;
    expect(points).toHaveLength(1);
    expect(points[0].attemptB?.value).toBe(1100);
  });

  it('refuses a queued station solve a delegate has typed in from the paper meanwhile', async () => {
    const [seed1, , , seed4] = seeds;
    await start(1);
    // The station lost its connection; the judge's paper goes in by hand
    await request(server())
      .post('/attempt')
      .set(as(users.DELEGATE))
      .send({
        attemptNumber: 1,
        value: 1000,
        penalty: 0,
        roundId,
        competitorId: seed1.id,
        status: 'STANDARD',
        type: 'STANDARD_ATTEMPT',
      })
      .expect(201);

    // The station reconnects and sends the solve it kept
    expect(await solve(seed1, 1000)).toEqual(
      refused(textsFor(seed1).t('attemptAlreadyEntered')),
    );
    expect(await attemptsOf(seed1)).toHaveLength(1);
    expect(matchOf(await getView(), 1).sets[0].points).toHaveLength(1);

    // A different time is the next point's, as usual
    await solve(seed4, 1100, { espId: ESP.b });
    expect(await solve(seed1, 1200)).toEqual(
      ok(textsFor(seed1).t('h2hWaitingForOpponent')),
    );
  });

  it('refuses a competitor with no playing match at the card scan and at the solve, saving nothing', async () => {
    // Semifinal 2 (seeds 2 and 3) is ready but hasn't started
    const seed2 = seeds[1];
    await start(1);

    // Solved before the scan: the time stays for once the match is started
    expect(await scan(seed2)).toMatchObject(
      scanRefused(seed2, 'h2hNoMatchInProgress', false),
    );

    expect(await solve(seed2, 1000)).toEqual(
      refused(textsFor(seed2).t('h2hNoMatchInProgress')),
    );
    expect(
      await db.result.count({ where: { personId: seed2.id, roundId } }),
    ).toBe(0);
  });

  it('drops the time of a competitor whose match is over, at the scan and at the solve', async () => {
    const [seed1, , , seed4] = seeds;
    await start(1);
    await solve(seed1, 1000);
    await solve(seed4, 1100, { espId: ESP.b });
    // Seed 1 retires: seed 4 goes to the final, which waits for semifinal 2
    await request(server())
      .post(`/h2h/match/${matchOf(await getView(), 1).id}/retire`)
      .set(as(users.DELEGATE))
      .send({ side: 'A', comment: 'Hurt wrist' })
      .expect(200);

    expect(await scan(seed4)).toMatchObject(
      scanRefused(seed4, 'h2hNoMatchInProgress', true),
    );
    expect(await solve(seed4, 1200, { espId: ESP.b })).toEqual(
      refused(textsFor(seed4).t('h2hNoMatchInProgress')),
    );
    expect(await attemptsOf(seed4)).toHaveLength(1);
  });

  it('offers only the rounds that can take the solve on a station running several', async () => {
    const [seed1, seed2] = seeds;
    const eventId = roundId.split('-r')[0];
    const room = await fixtures.createRoom('both-rounds', [
      groupId,
      `${eventId}-r1-g1`,
    ]);
    await fixtures.createDevice('station-both', ESP.bothRounds, room.id);
    await start(1);

    const playing = await scan(seed1, ESP.bothRounds);
    expect(
      playing.data.possibleGroups.map((g: { groupId: string }) => g.groupId),
    ).toEqual(expect.arrayContaining([groupId, `${eventId}-r1-g1`]));

    const notPlaying = await scan(seed2, ESP.bothRounds);
    expect(notPlaying.type).toBe('PersonInfoResp');
    expect(
      notPlaying.data.possibleGroups.map((g: { groupId: string }) => g.groupId),
    ).toEqual([`${eventId}-r1-g1`]);
  });

  it('refuses a station solve with no scramble left for the point', async () => {
    const [seed1, , , seed4] = seeds;
    // Set A keeps one scramble, and every other set is in the plan
    await db.scramble.deleteMany({
      where: {
        scrambleSet: { roundId, set: 'A' },
        NOT: { num: 1, isExtra: false },
      },
    });
    await start(1);
    await solve(seed1, 1000);
    await solve(seed4, 1100, { espId: ESP.b });

    expect(await solve(seed1, 1000)).toEqual(
      refused(textsFor(seed1).t('h2hNoScrambleLeft')),
    );
    expect(await attemptsOf(seed1)).toHaveLength(1);
  });

  it('turns the station inspection off in the head-to-head round only, and names the next point', async () => {
    const [seed1, , , seed4] = seeds;
    await start(1);
    await solve(seed1, 1000);
    await solve(seed4, 1100, { espId: ESP.b });

    const h2h = await station.request('PersonInfo', {
      cardId: seed1.cardId,
      espId: ESP.a,
      isCompetitor: true,
    });
    expect(h2h.type).toBe('PersonInfoResp');
    expect(h2h.data.possibleGroups).toEqual([
      expect.objectContaining({
        groupId,
        useInspection: false,
        secondaryText: getTranslation('h2hNextPoint', defaultLocale)
          .replace('{0}', '1')
          .replace('{1}', '2'),
      }),
    ]);

    // The same event's earlier round keeps the event's own inspection
    const earlier = await station.request('PersonInfo', {
      cardId: seed1.cardId,
      espId: ESP.otherRound,
      isCompetitor: false,
    });
    expect(earlier.type).toBe('PersonInfoResp');
    expect(earlier.data.possibleGroups).toEqual([
      expect.objectContaining({
        groupId: `${roundId.split('-r')[0]}-r1-g1`,
        useInspection: true,
      }),
    ]);
  });

  it('holds the point while an incident on it is open, and decides it once resolved without an extra', async () => {
    const [seed1, , , seed4] = seeds;
    await start(1);

    expect(await solve(seed1, 1000, { isDelegate: true })).toMatchObject({
      type: 'EnterAttemptResp',
      data: { message: textsFor(seed1).t('delegateWasNotified') },
    });
    const [incident] = await attemptsOf(seed1);
    expect(incident.status).toBe(AttemptStatus.UNRESOLVED);
    // Seed 4 still has point 1 to race
    expect((await scan(seed4, ESP.b)).type).toBe('PersonInfoResp');
    expect(await solve(seed4, 1100, { espId: ESP.b })).toEqual(
      ok(textsFor(seed4).t('h2hWaitingForDelegate')),
    );
    let point = matchOf(await getView(), 1).sets[0].points[0];
    expect(point).toMatchObject({ decided: false, winnerSide: null });
    expect(point.attemptA?.id).toBe(incident.id);

    // The point may be raced again, so nobody moves on before the delegate
    expect(await scan(seed4, ESP.b)).toMatchObject(
      scanRefused(seed4, 'h2hWaitingForDelegate', true),
    );
    expect(await solve(seed4, 1200, { espId: ESP.b })).toEqual(
      refused(textsFor(seed4).t('h2hWaitingForDelegate')),
    );

    // "No extra" on the incident
    await request(server())
      .put(`/attempt/${incident.id}`)
      .set(as(users.DELEGATE))
      .send({
        attemptNumber: incident.attemptNumber,
        value: incident.value,
        penalty: 0,
        status: AttemptStatus.RESOLVED,
        type: incident.type,
      })
      .expect(200);
    point = matchOf(await getView(), 1).sets[0].points[0];
    expect(point).toMatchObject({ decided: true, winnerSide: 'A' });
    expect(await solve(seed4, 1200, { espId: ESP.b })).toEqual(
      ok(textsFor(seed4).t('h2hWaitingForOpponent')),
    );
  });

  it('races a point given an extra again as extra attempts, replacing the old ones', async () => {
    const [seed1, , , seed4] = seeds;
    await start(1);
    await solve(seed1, 1000);
    await solve(seed4, 1100, { espId: ESP.b });
    const raced = matchOf(await getView(), 1).sets[0].points[0];
    await request(server())
      .post(`/h2h/point/${raced.id}/extra`)
      .set(as(users.DELEGATE))
      .send({ comment: 'Puzzle defect' })
      .expect(200);

    expect(await solve(seed1, 1300)).toEqual(
      ok(textsFor(seed1).t('h2hWaitingForOpponent')),
    );
    const [original, extra] = await attemptsOf(seed1);
    expect(original).toMatchObject({
      status: AttemptStatus.EXTRA_GIVEN,
      replacedBy: 2,
    });
    expect(extra).toMatchObject({
      attemptNumber: 2,
      type: AttemptType.EXTRA_ATTEMPT,
      value: 1300,
    });
    expect(
      await db.attemptEditLog.count({
        where: { attemptId: original.id, comment: 'Replaced by extra 2' },
      }),
    ).toBe(1);
    await solve(seed4, 1200, { espId: ESP.b });
    const point = matchOf(await getView(), 1).sets[0].points[0];
    expect(point).toMatchObject({
      decided: true,
      winnerSide: 'B',
      attemptA: { id: extra.id },
    });
  });

  it('marks a station attempt amended after its match, even from a station clock running ahead', async () => {
    const [seed1, , , seed4] = seeds;
    await start(1);
    for (let i = 0; i < 2; i++) {
      await solve(seed1, 1000);
      await solve(seed4, 1100, { espId: ESP.b });
    }
    await solve(seed4, 1100, { espId: ESP.b });
    const ahead = new Date(Date.now() + 60_000).toISOString();
    await solve(seed1, 1000, { solvedAt: ahead });
    const last = found((await attemptsOf(seed1)).at(-1), 'last attempt');
    expect(
      await db.attemptEditLog.count({
        where: { attemptId: last.id, comment: 'Original entry' },
      }),
    ).toBe(1);

    await request(server())
      .put(`/attempt/${last.id}`)
      .set(as(users.DELEGATE))
      .send({
        attemptNumber: last.attemptNumber,
        value: 1500,
        penalty: 0,
        status: AttemptStatus.STANDARD,
        type: last.type,
      })
      .expect(200);

    const points = matchOf(await getView(), 1).sets[0].points;
    // 11l1: the winner stays, and the screen says the time changed
    expect(points[2]).toMatchObject({
      winnerSide: 'A',
      amendedAfterMatch: true,
      attemptA: { value: 1500 },
    });
    expect(points[0].amendedAfterMatch).toBe(false);
  });

  describe('the scrambling device', () => {
    const asDevice = (req: request.Test) =>
      req.set('Authorization', `Token ${SCRAMBLING_TOKEN}`);
    const scrambles = async () =>
      (
        await asDevice(
          request(server()).get(`/scrambling/h2h/${roundId}`),
        ).expect(200)
      ).body as {
        matchId: string;
        label: string;
        setNumber: number;
        pointNumber: number;
        scramble: {
          scrambleSetId: string;
          set: string;
          num: number;
          isExtra: boolean;
        } | null;
        text: string;
        warning: string | null;
      }[];

    it("lists every playing match with its set and the next point's scramble", async () => {
      const [seed1, , , seed4] = seeds;
      expect(await scrambles()).toEqual([]);
      await start(1);
      await start(2);

      const both = await scrambles();
      expect(both.map((m) => m.text)).toEqual([
        'Semifinal 1 · set 1 · Set A, scramble 1',
        'Semifinal 2 · set 1 · Set B, scramble 1',
      ]);
      const setA = found(
        await db.scrambleSet.findFirst({ where: { roundId, set: 'A' } }),
        'set A',
      );
      expect(both[0]).toMatchObject({
        label: 'Semifinal 1',
        setNumber: 1,
        pointNumber: 1,
        scramble: { scrambleSetId: setA.id, set: 'A', num: 1, isExtra: false },
      });

      // The open point keeps its scramble until both have raced it
      await solve(seed1, 1000);
      expect((await scrambles())[0].text).toBe(
        'Semifinal 1 · set 1 · Set A, scramble 1',
      );
      await solve(seed4, 1100, { espId: ESP.b });
      expect((await scrambles())[0]).toMatchObject({
        pointNumber: 2,
        text: 'Semifinal 1 · set 1 · Set A, scramble 2',
      });
    });

    it("keeps an incident point's scramble, with a warning to wait", async () => {
      const [seed1, , , seed4] = seeds;
      await start(1);
      await solve(seed1, 1000, { isDelegate: true });
      await solve(seed4, 1100, { espId: ESP.b });

      const [semi] = await scrambles();
      expect(semi.text).toBe('Semifinal 1 · set 1 · Set A, scramble 1');
      expect(semi.warning).toMatch(/^An incident on point 1 is open/);
    });

    it('refuses a round that is not head-to-head', async () => {
      await asDevice(
        request(server()).get(`/scrambling/h2h/${roundId.split('-r')[0]}-r1`),
      ).expect(400);
    });
  });
});
