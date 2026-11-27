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

/**
 * The keys the public bracket has at each place in it, exactly: an array's
 * items share a path ending in []. Anything else is a leak.
 */
const PUBLIC_SHAPE: Record<string, string[]> = {
  '': ['entrants', 'matches', 'roundId', 'size', 'stages', 'status'],
  'stages[]': ['label', 'setsToWin', 'stage'],
  'entrants[]': [
    'bestSingle',
    'countryIso2',
    'id',
    'name',
    'position',
    'registrantId',
    'seed',
    'stageReached',
  ],
  'matches[]': [
    'endedBy',
    'id',
    'label',
    'matchNumber',
    'score',
    'sets',
    'setsToWin',
    'sideA',
    'sideB',
    'stage',
    'status',
    'winnerSide',
  ],
  'matches[].score': ['a', 'b'],
  'matches[].sideA': ['entrantId', 'source'],
  'matches[].sideB': ['entrantId', 'source'],
  'matches[].sideA.source': ['matchNumber', 'outcome'],
  'matches[].sideB.source': ['matchNumber', 'outcome'],
  'matches[].sets[]': ['decidedBy', 'points', 'setNumber', 'winnerSide'],
  'matches[].sets[].points[]': [
    'a',
    'b',
    'decided',
    'extraGranted',
    'pointNumber',
    'winnerSide',
  ],
  // A time, and nothing else about the attempt
  'matches[].sets[].points[].a': ['penalty', 'value'],
  'matches[].sets[].points[].b': ['penalty', 'value'],
};

/** Every object's keys in the answer, by where it sits */
const shapeOf = (
  value: unknown,
  path = '',
  shape = new Map<string, Set<string>>(),
) => {
  if (Array.isArray(value)) {
    value.forEach((item) => shapeOf(item, `${path}[]`, shape));
  } else if (value !== null && typeof value === 'object') {
    const keys = shape.get(path) ?? new Set<string>();
    shape.set(path, keys);
    for (const [key, child] of Object.entries(value)) {
      keys.add(key);
      shapeOf(child, path ? `${path}.${key}` : key, shape);
    }
  }
  return shape;
};

/** Fails on any object in the answer with a key it shouldn't have */
const expectPublicShape = (body: unknown) => {
  const shape = shapeOf(body);
  // Every place the check knows must have turned up, so none is skipped
  expect([...shape.keys()].sort()).toEqual(Object.keys(PUBLIC_SHAPE).sort());
  for (const [path, keys] of shape) {
    expect({ path, keys: [...keys].sort() }).toEqual({
      path,
      keys: PUBLIC_SHAPE[path],
    });
  }
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

  it('leaves out card ids, registration ids, attempt ids, statuses, comments and scrambles', async () => {
    const [first] = seeds;
    const original = { cardId: first.cardId };
    await db.person.update({
      where: { id: first.id },
      data: { cardId: '908172635', wcaRegistrationId: 71829364 },
    });
    try {
      const view = (await getPublic().expect(200)).body as PublicView;
      const semi = matchOf(view, 1);
      const a = personOf(view, semi.sideA.entrantId);
      const b = personOf(view, semi.sideB.entrantId);
      await request(server())
        .post(`/h2h/match/${semi.id}/start`)
        .set(as(users.STAGE_LEADER))
        .expect(200);
      await enter(a, 1000);
      await enter(b, 1100);
      // An incident on A's next solve: the point waits for the delegate
      await enter(a, 990);
      const staff = await request(server())
        .get(`/h2h/${roundId}`)
        .set(as(users.DELEGATE))
        .expect(200);
      const incident = staff.body.bracket.matches[0].sets[0].points[1].attemptA;
      await request(server())
        .put(`/attempt/${incident.id}`)
        .set(as(users.DELEGATE))
        .send({
          attemptNumber: incident.attemptNumber,
          value: 990,
          penalty: 0,
          status: 'UNRESOLVED',
          type: 'STANDARD_ATTEMPT',
        })
        .expect(200);
      await enter(b, 1050);

      const res = await getPublic().expect(200);
      expectPublicShape(res.body);
      const points = matchOf(res.body as PublicView, 1).sets[0].points;
      expect(points[1]).toEqual({
        pointNumber: 2,
        winnerSide: null,
        decided: false,
        a: { value: 990, penalty: 0 },
        b: { value: 1050, penalty: 0 },
        extraGranted: false,
      });

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
        'UNRESOLVED',
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

  it('leaves out points and sets raced after the match was over', async () => {
    // First to 2 sets this time
    await clean();
    await request(server())
      .post(`/h2h/${roundId}`)
      .set(as(users.DELEGATE))
      .send({ size: 4, setsToWin: { SEMIFINAL: 2, THIRD_PLACE: 2, FINAL: 2 } })
      .expect(201);
    await request(server())
      .put(`/h2h/${roundId}/seeds`)
      .set(as(users.DELEGATE))
      .send({ personIds: seeds.map((p) => p.id) })
      .expect(200);
    await importSets(['A', 'B', 'C', 'D']);
    const view = (await getPublic().expect(200)).body as PublicView;
    const semi = matchOf(view, 1);
    const a = personOf(view, semi.sideA.entrantId);
    const b = personOf(view, semi.sideB.entrantId);
    const point = async (aValue: number, bValue: number) => {
      await enter(a, aValue);
      await enter(b, bValue);
    };
    await request(server())
      .post(`/h2h/match/${semi.id}/start`)
      .set(as(users.STAGE_LEADER))
      .expect(200);
    // Set 1 to A; set 2 goes A, A, B, B, B; set 3 to A, who wins 2-1
    for (let i = 0; i < 3; i++) await point(1000, 1100);
    await point(1000, 1100);
    await point(1000, 1100);
    for (let i = 0; i < 3; i++) await point(1200, 1100);
    for (let i = 0; i < 3; i++) await point(1000, 1100);
    expect(matchOf((await getPublic()).body, 1).sets).toHaveLength(3);

    // B's point 3 in set 2 was a DNF: A had set 2, and the match, at 3-0
    const staff = await request(server())
      .get(`/h2h/${roundId}`)
      .set(as(users.DELEGATE))
      .expect(200);
    const staffMatch = staff.body.bracket.matches.find(
      (m: { matchNumber: number }) => m.matchNumber === 1,
    );
    const dnf = staffMatch.sets[1].points[2].attemptB;
    await request(server())
      .put(`/attempt/${dnf.id}`)
      .set(as(users.DELEGATE))
      .send({
        attemptNumber: dnf.attemptNumber,
        value: dnf.value,
        penalty: -1,
        status: 'STANDARD',
        type: 'STANDARD_ATTEMPT',
      })
      .expect(200);
    await request(server())
      .post(`/h2h/match/${semi.id}/reopen`)
      .set(as(users.DELEGATE))
      .send({ comment: 'Point 3 was a DNF' })
      .expect(200);

    const after = matchOf((await getPublic().expect(200)).body, 1);
    expect(after).toMatchObject({
      status: 'FINISHED',
      winnerSide: 'A',
      score: { a: 2, b: 0 },
    });
    // Set 2's points 4 and 5, and the whole of set 3, count nowhere
    expect(after.sets.map((set) => set.setNumber)).toEqual([1, 2]);
    expect(after.sets[1].points.map((p) => p.winnerSide)).toEqual([
      'A',
      'A',
      'A',
    ]);
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
