import { INestApplication } from '@nestjs/common';
import { Socket } from 'socket.io-client';
import { AppGateway } from 'src/app.gateway';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';
import { Competition } from 'wcif-helpers';

import { disconnectSeedDb, seedH2hBracket } from '../prisma/seed/seed-test';
import { Person, Prisma } from '../src/generated/prisma/client';
import { found } from '../src/test-utils/found';
import { createTestApp } from './helpers/app.helper';
import {
  createRoleUsers,
  deleteSetupUsers,
  TestUser,
} from './helpers/setup-roles.helper';
import {
  connectSocketIo,
  joinRoom,
  listenOnRandomPort,
  waitForEvent,
} from './helpers/socketio.helper';

const SUFFIX = 'h2h-public';

/** Every key the public bracket may have, at any depth */
const PUBLIC_KEYS = new Set([
  // the round
  'roundId',
  'size',
  'status',
  'stages',
  'entrants',
  'matches',
  // stages
  'stage',
  'label',
  'setsToWin',
  // entrants
  'id',
  'seed',
  'name',
  'countryIso2',
  'registrantId',
  'bestSingle',
  'position',
  'stageReached',
  // matches
  'matchNumber',
  'winnerSide',
  'endedBy',
  'sideA',
  'sideB',
  'entrantId',
  'source',
  'outcome',
  'score',
  'a',
  'b',
  'sets',
  // sets and points
  'setNumber',
  'decidedBy',
  'points',
  'pointNumber',
  'decided',
  'value',
  'penalty',
  'extraGranted',
]);

const keysOf = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => [
    key,
    ...keysOf(child),
  ]);
};

interface PublicPoint {
  pointNumber: number;
  winnerSide: 'A' | 'B' | null;
  decided: boolean;
  a: { value: number; penalty: number } | null;
  b: { value: number; penalty: number } | null;
  extraGranted: boolean;
}

interface PublicMatch {
  id: string;
  matchNumber: number;
  label: string;
  stage: string;
  status: string;
  winnerSide: 'A' | 'B' | null;
  sideA: {
    entrantId: string | null;
    source: { matchNumber: number; outcome: string } | null;
  };
  sideB: {
    entrantId: string | null;
    source: { matchNumber: number; outcome: string } | null;
  };
  score: { a: number; b: number };
  sets: {
    setNumber: number;
    winnerSide: 'A' | 'B' | null;
    decidedBy: string | null;
    points: PublicPoint[];
  }[];
}

interface PublicView {
  roundId: string;
  size: number;
  status: string;
  stages: { stage: string; label: string; setsToWin: number }[];
  entrants: {
    id: string;
    seed: number;
    name: string;
    countryIso2: string | null;
    registrantId: number | null;
    bestSingle: number | null;
    position: number | null;
    stageReached: string | null;
  }[];
  matches: PublicMatch[];
}

describe('Public head-to-head bracket (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let gateway: AppGateway;
  let url: string;
  let users: Record<'DELEGATE' | 'STAGE_LEADER' | 'STAFF', TestUser>;
  let originalWcif: Prisma.JsonValue;
  let roundId: string;
  /** Four people registered for the event: seeds 1 to 4 */
  let seeds: Person[];
  const sockets: Socket[] = [];

  const server = () => app.getHttpServer();
  const as = (user: TestUser) => ({
    Authorization: `Bearer ${user.token}`,
  });
  const getPublic = () => request(server()).get(`/h2h/public/${roundId}`);
  const matchOf = (view: PublicView, matchNumber: number) =>
    found(
      view.matches.find((m) => m.matchNumber === matchNumber),
      `match ${matchNumber}`,
    );
  const entrantOf = (view: PublicView, entrantId: string | null) =>
    found(
      view.entrants.find((e) => e.id === entrantId),
      'entrant',
    );
  const personOf = (view: PublicView, entrantId: string | null) => {
    const { seed } = entrantOf(view, entrantId);
    return seeds[seed - 1].id;
  };
  const importSets = (letters: string[]) =>
    request(server())
      .post('/scramble-set/import')
      .set(as(users.DELEGATE))
      .send({
        scrambleSets: letters.map((set) => ({
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
        })),
      })
      .expect(201);
  /** Manual entry with a note only staff may read */
  const enter = (personId: string, value: number) =>
    request(server())
      .post('/attempt')
      .set(as(users.DELEGATE))
      .send({
        attemptNumber: 99,
        value,
        penalty: 0,
        roundId,
        competitorId: personId,
        status: 'STANDARD',
        type: 'STANDARD_ATTEMPT',
        comment: 'Private note about the judge',
      })
      .expect(201);

  const clean = async () => {
    // Points hold their attempts and scrambles, so the bracket goes first
    await db.h2hBracket.deleteMany();
    await db.result.deleteMany({ where: { roundId } });
    await db.scrambleSet.deleteMany({ where: { roundId } });
  };

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    url = await listenOnRandomPort(app);
    gateway = app.get(AppGateway);
    await deleteSetupUsers(db, SUFFIX);
    users = await createRoleUsers(app, db, SUFFIX);
    const competition = found(
      await db.competition.findFirst(),
      'seeded competition',
    );
    originalWcif = competition.wcif;
    const wcif = competition.wcif as unknown as Competition;
    const round = found(
      wcif.events.flatMap((e) => e.rounds).find((r) => r.format === 'h'),
      'a head-to-head round in the dummy WCA competition',
    );
    roundId = round.id;
    const eventId = roundId.split('-r')[0];
    const registrantIds = wcif.persons
      .filter(
        (p) =>
          p.registration?.status === 'accepted' &&
          p.registration.eventIds.includes(eventId as never),
      )
      .map((p) => p.registrantId);
    seeds = (
      await db.person.findMany({
        where: { registrantId: { in: registrantIds } },
        orderBy: { registrantId: 'asc' },
      })
    ).slice(0, 4);
    expect(seeds).toHaveLength(4);
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
    await importSets(['A', 'B', 'C', 'D']);
  });

  afterEach(() => {
    sockets.splice(0).forEach((socket) => socket.close());
  });

  afterAll(async () => {
    await clean();
    // Leave the bracket the seed gives, for whatever runs next
    await seedH2hBracket(originalWcif as unknown as Competition);
    await disconnectSeedDb();
    await deleteSetupUsers(db, SUFFIX);
    await app.close();
  }, 30000);

  it('shows the bracket without signing in: stages, sources, scores and times', async () => {
    const before = (await getPublic().expect(200)).body as PublicView;
    expect(before.roundId).toBe(roundId);
    expect(before.size).toBe(4);
    expect(before.stages).toEqual([
      { stage: 'SEMIFINAL', label: 'Semifinal', setsToWin: 1 },
      { stage: 'THIRD_PLACE', label: 'Third-place match', setsToWin: 1 },
      { stage: 'FINAL', label: 'Final', setsToWin: 1 },
    ]);
    expect(before.entrants.map((e) => [e.seed, e.name])).toEqual(
      seeds.map((person, i) => [i + 1, person.name]),
    );
    expect(before.entrants[0]).toEqual({
      id: expect.any(String),
      seed: 1,
      name: seeds[0].name,
      countryIso2: seeds[0].countryIso2,
      registrantId: seeds[0].registrantId,
      bestSingle: null,
      position: null,
      stageReached: 'SEMIFINAL',
    });

    const semi = matchOf(before, 1);
    const a = personOf(before, semi.sideA.entrantId);
    const b = personOf(before, semi.sideB.entrantId);
    await request(server())
      .post(`/h2h/match/${semi.id}/start`)
      .set(as(users.STAGE_LEADER))
      .expect(200);
    // Two points to A, then A's time is in on the third
    for (let i = 0; i < 2; i++) {
      await enter(a, 1000 + i);
      await enter(b, 1200);
    }
    await enter(a, 990);

    const playing = (await getPublic().expect(200)).body as PublicView;
    const live = matchOf(playing, 1);
    expect(live.status).toBe('IN_PROGRESS');
    expect(live.sets).toHaveLength(1);
    expect(live.sets[0].points).toEqual([
      {
        pointNumber: 1,
        winnerSide: 'A',
        decided: true,
        a: { value: 1000, penalty: 0 },
        b: { value: 1200, penalty: 0 },
        extraGranted: false,
      },
      {
        pointNumber: 2,
        winnerSide: 'A',
        decided: true,
        a: { value: 1001, penalty: 0 },
        b: { value: 1200, penalty: 0 },
        extraGranted: false,
      },
      {
        pointNumber: 3,
        winnerSide: null,
        decided: false,
        a: { value: 990, penalty: 0 },
        b: null,
        extraGranted: false,
      },
    ]);

    await enter(b, 1300);
    const after = (await getPublic().expect(200)).body as PublicView;
    const done = matchOf(after, 1);
    expect(done).toMatchObject({
      label: 'Semifinal 1',
      stage: 'SEMIFINAL',
      status: 'FINISHED',
      winnerSide: 'A',
      score: { a: 1, b: 0 },
    });
    expect(done.sets[0]).toMatchObject({
      winnerSide: 'A',
      decidedBy: 'POINTS',
    });
    // The winner fills the final, the loser the third-place match
    const final = found(
      after.matches.find((m) => m.stage === 'FINAL'),
      'final',
    );
    const third = found(
      after.matches.find((m) => m.stage === 'THIRD_PLACE'),
      'third-place match',
    );
    expect(final.sideA).toEqual({
      entrantId: semi.sideA.entrantId,
      source: { matchNumber: 1, outcome: 'WINNER' },
    });
    // Semifinal 1's loser is expected to be seed 4, so takes side B
    expect(third.sideB).toEqual({
      entrantId: semi.sideB.entrantId,
      source: { matchNumber: 1, outcome: 'LOSER' },
    });
    expect(entrantOf(after, semi.sideA.entrantId)).toMatchObject({
      bestSingle: 990,
      stageReached: 'FINAL',
    });
  });

  it('leaves out card ids, registration ids, attempt ids, comments and scrambles', async () => {
    const [first] = seeds;
    const original = { cardId: first.cardId };
    await db.person.update({
      where: { id: first.id },
      data: { cardId: '908172635', wcaRegistrationId: 71829364 },
    });
    try {
      const view = (await getPublic().expect(200)).body as PublicView;
      const semi = matchOf(view, 1);
      await request(server())
        .post(`/h2h/match/${semi.id}/start`)
        .set(as(users.STAGE_LEADER))
        .expect(200);
      await enter(personOf(view, semi.sideA.entrantId), 1000);
      await enter(personOf(view, semi.sideB.entrantId), 1100);

      const res = await getPublic().expect(200);
      const unexpected = [...new Set(keysOf(res.body))].filter(
        (key) => !PUBLIC_KEYS.has(key),
      );
      expect(unexpected).toEqual([]);

      const text = res.text;
      const attempts = await db.attempt.findMany({
        where: { result: { roundId } },
        select: { id: true },
      });
      const scrambleSets = await db.scrambleSet.findMany({
        where: { roundId },
        select: { id: true },
      });
      expect(attempts.length).toBeGreaterThan(0);
      for (const secret of [
        '908172635',
        '71829364',
        'Private note',
        'encrypted-',
        ...attempts.map((attempt) => attempt.id),
        ...scrambleSets.map((set) => set.id),
        ...seeds.map((person) => person.id),
      ]) {
        expect(text).not.toContain(secret);
      }
    } finally {
      await db.person.update({
        where: { id: first.id },
        data: {
          cardId: original.cardId,
          wcaRegistrationId: first.wcaRegistrationId,
        },
      });
    }
  });

  it('answers 404 for a round without a bracket', async () => {
    await db.h2hBracket.deleteMany();
    const res = await getPublic().expect(404);
    expect(res.body.message).toBe('This round has no bracket');
    await request(server()).get('/h2h/public/333-r1').expect(404);
    await request(server()).get('/h2h/public/not-a-round').expect(400);
  });

  it('lets a signed-out spectator follow changes, telling them only what to refetch', async () => {
    const view = (await getPublic().expect(200)).body as PublicView;
    const semi = matchOf(view, 1);
    const socket = await connectSocketIo(url);
    sockets.push(socket);
    await joinRoom(gateway, socket, 'joinH2h', `h2h-${roundId}`, { roundId });

    const started = waitForEvent(
      socket,
      'h2hUpdated',
      (payload: { matchId: string | null }) => payload.matchId === semi.id,
    );
    await request(server())
      .post(`/h2h/match/${semi.id}/start`)
      .set(as(users.STAGE_LEADER))
      .expect(200);
    expect(await started).toEqual({ roundId, matchId: semi.id });
  });
});
