import { INestApplication } from '@nestjs/common';
import { Socket } from 'socket.io-client';
import { AppGateway } from 'src/app.gateway';
import { DbService } from 'src/db/db.service';
import { WAITING_FOR_OPPONENT } from 'src/h2h/matchEngine';
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

const SUFFIX = 'h2h-matches';

interface AttemptView {
  id: string;
  attemptNumber: number;
  value: number;
  penalty: number;
}

interface PointView {
  id: string;
  pointNumber: number;
  winnerSide: 'A' | 'B' | null;
  decided: boolean;
  attemptA: AttemptView | null;
  attemptB: AttemptView | null;
  scramble: { set: string; num: number; isExtra: boolean } | null;
}

interface MatchView {
  id: string;
  matchNumber: number;
  label: string;
  stage: string;
  status: string;
  winnerSide: 'A' | 'B' | null;
  score: { a: number; b: number };
  sideA: { entrantId: string | null };
  sideB: { entrantId: string | null };
  sets: {
    setNumber: number;
    winnerSide: 'A' | 'B' | null;
    decidedBy: string | null;
    scrambleSet: { id: string; set: string } | null;
    points: PointView[];
  }[];
  scrambleInUse: { text: string; warning: string | null } | null;
}

interface View {
  bracket: {
    status: string;
    entrants: {
      id: string;
      seed: number;
      person: { id: string };
      position: number | null;
      stageReached: string | null;
      bestSingle: number | null;
    }[];
    matches: MatchView[];
  };
  scramblePlan: {
    rows: {
      matchNumber: number;
      setNumber: number;
      scrambleSetId: string | null;
    }[];
    scrambleSets: { id: string; set: string }[];
  };
}

/** Sets of 5 scrambles and 2 extras unless told otherwise */
const scrambleSet = (roundId: string, set: string, count = 5, extras = 2) => ({
  roundId,
  set,
  scrambles: [
    ...Array.from({ length: count }, (_, i) => ({
      num: i + 1,
      encryptedScramble: `encrypted-${set}-${i + 1}`,
      isExtra: false,
    })),
    ...Array.from({ length: extras }, (_, i) => ({
      num: i + 1,
      encryptedScramble: `encrypted-${set}-e${i + 1}`,
      isExtra: true,
    })),
  ],
});

describe('Head-to-head matches (e2e)', () => {
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
  const personOf = (view: View, entrantId: string | null) =>
    found(
      view.bracket.entrants.find((e) => e.id === entrantId),
      'entrant',
    ).person.id;
  const importSets = (letters: string[], count = 5, extras = 2) =>
    request(server())
      .post('/scramble-set/import')
      .set(as(users.DELEGATE))
      .send({
        scrambleSets: letters.map((set) =>
          scrambleSet(roundId, set, count, extras),
        ),
      })
      .expect(201);
  const start = (matchId: string, user = users.STAGE_LEADER) =>
    request(server()).post(`/h2h/match/${matchId}/start`).set(as(user));
  /** Manual entry; the attempt number given is ignored for these rounds */
  const enter = (personId: string, value: number, penalty = 0) =>
    request(server()).post('/attempt').set(as(users.DELEGATE)).send({
      attemptNumber: 99,
      value,
      penalty,
      roundId,
      competitorId: personId,
      status: 'STANDARD',
      type: 'STANDARD_ATTEMPT',
    });
  const edit = (attempt: AttemptView, value: number) =>
    request(server())
      .put(`/attempt/${attempt.id}`)
      .set(as(users.DELEGATE))
      .send({
        attemptNumber: attempt.attemptNumber,
        value,
        penalty: 0,
        status: 'STANDARD',
        type: 'STANDARD_ATTEMPT',
      });
  /** Both sides of a match: A and B's person ids */
  const sides = async (matchNumber: number) => {
    const view = await getView();
    const match = matchOf(view, matchNumber);
    return {
      id: match.id,
      a: personOf(view, match.sideA.entrantId),
      b: personOf(view, match.sideB.entrantId),
    };
  };
  /** A point side A wins, entered A first */
  const pointToA = async (a: string, b: string) => {
    await enter(a, 1000).expect(201);
    await enter(b, 1100).expect(201);
  };
  /** Plays a match to 3 points per set for A, `sets` times */
  const winForA = async (matchNumber: number, sets = 1) => {
    const match = await sides(matchNumber);
    await start(match.id).expect(200);
    for (let i = 0; i < 3 * sets; i++) await pointToA(match.a, match.b);
    return match;
  };
  const attemptsOf = (personId: string) =>
    db.attempt.findMany({
      where: { result: { personId, roundId } },
      orderBy: { attemptNumber: 'asc' },
    });

  /** A fresh 4-competitor bracket with these sets to win per stage */
  const setUpBracket = async (setsToWin: Record<string, number> = {}) => {
    await request(server())
      .post(`/h2h/${roundId}`)
      .set(as(users.DELEGATE))
      .send({ size: 4, setsToWin })
      .expect(201);
    await request(server())
      .put(`/h2h/${roundId}/seeds`)
      .set(as(users.DELEGATE))
      .send({ personIds: seeds.map((p) => p.id) })
      .expect(200);
  };

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

  describe('starting a match', () => {
    beforeEach(async () => {
      await setUpBracket();
      await importSets(['A', 'B', 'C', 'D']);
    });

    it('opens set 1 on the planned set, and refuses a match not ready or already playing', async () => {
      const before = await getView();
      const semi = matchOf(before, 1);
      const final = matchOf(before, 4);
      const planned = found(
        before.scramblePlan.rows.find(
          (row) => row.matchNumber === 1 && row.setNumber === 1,
        ),
        'plan row',
      ).scrambleSetId;

      await start(semi.id, users.STAFF).expect(403);
      await start(semi.id).expect(200);

      const after = await getView();
      const playing = matchOf(after, 1);
      expect(playing.status).toBe('IN_PROGRESS');
      expect(playing.sets).toHaveLength(1);
      expect(playing.sets[0].scrambleSet?.id).toBe(planned);
      expect(after.bracket.status).toBe('IN_PROGRESS');
      expect(playing.scrambleInUse?.text).toBe(
        'Semifinal 1 · set 1 · Set A, scramble 1',
      );

      const again = await start(semi.id).expect(409);
      expect(again.body.message).toBe('Semifinal 1 is playing already');
      const waiting = await start(final.id).expect(409);
      expect(waiting.body.message).toBe(
        "Final can't start until both competitors are known",
      );
    });

    it('refuses to start while a seed is still empty', async () => {
      // Three of four seeds: seeds lock with the first start, so seed 4
      // could never be filled
      await request(server())
        .put(`/h2h/${roundId}/seeds`)
        .set(as(users.DELEGATE))
        .send({ personIds: seeds.slice(0, 3).map((p) => p.id) })
        .expect(200);
      const semi2 = matchOf(await getView(), 2);
      expect(semi2.status).toBe('READY');

      const res = await start(semi2.id).expect(409);
      expect(res.body.message).toBe(
        'Fill every seed before the first match starts: 3 of 4 have a competitor',
      );
    });

    it('refuses a match whose competitor is playing another one', async () => {
      const view = await getView();
      const semi1 = matchOf(view, 1);
      const semi2 = matchOf(view, 2);
      await start(semi1.id).expect(200);
      // Not something a bracket gives, but the check must hold on its own
      await db.h2hMatch.update({
        where: { id: semi2.id },
        data: { entrantAId: semi1.sideA.entrantId },
      });

      const res = await start(semi2.id).expect(409);
      expect(res.body.message).toMatch(/is playing Semifinal 1 already$/);
    });
  });

  describe('manual entry', () => {
    beforeEach(async () => {
      await setUpBracket();
      await importSets(['A', 'B', 'C', 'D']);
    });

    it('refuses a competitor with no match in progress, and saves nothing', async () => {
      const res = await enter(seeds[0].id, 1000).expect(409);
      expect(res.body.message).toBe('No match in progress');
      expect(await attemptsOf(seeds[0].id)).toEqual([]);
      expect(
        await db.result.count({ where: { roundId, personId: seeds[0].id } }),
      ).toBe(0);
    });

    it('puts two entries into one point, decides it, and numbers attempts across the round', async () => {
      const semi = await sides(1);
      await start(semi.id).expect(200);

      await enter(semi.b, 1100).expect(201);
      let point = matchOf(await getView(), 1).sets[0].points[0];
      expect(point.attemptB?.value).toBe(1100);
      expect(point.attemptA).toBeNull();
      expect(point.decided).toBe(false);
      expect(point.scramble).toEqual({ set: 'A', num: 1, isExtra: false });

      await enter(semi.a, 1000).expect(201);
      const match = matchOf(await getView(), 1);
      point = match.sets[0].points[0];
      expect(match.sets[0].points).toHaveLength(1);
      expect(point.attemptA?.value).toBe(1000);
      expect(point.winnerSide).toBe('A');
      expect(point.decided).toBe(true);
      expect(point.attemptA?.attemptNumber).toBe(1);
      expect(point.attemptB?.attemptNumber).toBe(1);
      expect(match.scrambleInUse?.text).toBe(
        'Semifinal 1 · set 1 · Set A, scramble 2',
      );
    });

    it('refuses a second point ahead with "Waiting for opponent\'s result"', async () => {
      const semi = await sides(1);
      await start(semi.id).expect(200);
      await pointToA(semi.a, semi.b);
      await enter(semi.a, 1000).expect(201);

      const res = await enter(semi.a, 1000).expect(409);
      expect(res.body.message).toBe(WAITING_FOR_OPPONENT);
      expect(await attemptsOf(semi.a)).toHaveLength(2);
      // The opponent catching up is fine
      await enter(semi.b, 900).expect(201);
      const points = matchOf(await getView(), 1).sets[0].points;
      expect(points.map((p) => p.winnerSide)).toEqual(['A', 'B']);
    });

    it('finishes the match and fills the final with the winners and the third-place match with the losers', async () => {
      const semi1 = await winForA(1);
      const semi2 = await sides(2);
      await start(semi2.id).expect(200);
      for (let i = 0; i < 3; i++) {
        await enter(semi2.a, 1200).expect(201);
        await enter(semi2.b, 1100).expect(201);
      }

      const view = await getView();
      const played = matchOf(view, 1);
      expect(played.status).toBe('FINISHED');
      expect(played.winnerSide).toBe('A');
      expect(played.score).toEqual({ a: 1, b: 0 });
      expect(played.sets[0].decidedBy).toBe('POINTS');
      const third = matchOf(view, 3);
      const final = matchOf(view, 4);
      expect(third.stage).toBe('THIRD_PLACE');
      expect(final.stage).toBe('FINAL');
      expect([third.status, final.status]).toEqual(['READY', 'READY']);
      const both = (match: MatchView) =>
        [match.sideA, match.sideB]
          .map((side) => personOf(view, side.entrantId))
          .sort();
      expect(both(final)).toEqual([semi1.a, semi2.b].sort());
      expect(both(third)).toEqual([semi1.b, semi2.a].sort());
      // Out of their match, so nothing more goes in
      await enter(semi1.b, 1000).expect(409);

      const thirdPlace = await winForA(3);
      const finalMatch = await winForA(4);
      const done = await getView();
      expect(done.bracket.status).toBe('FINISHED');
      const ranked = (personId: string) =>
        done.bracket.entrants.find((e) => e.person.id === personId);
      expect(ranked(finalMatch.a)).toMatchObject({
        position: 1,
        stageReached: 'FINAL',
        bestSingle: 1000,
      });
      expect(ranked(finalMatch.b)?.position).toBe(2);
      expect(ranked(thirdPlace.a)).toMatchObject({
        position: 3,
        stageReached: 'THIRD_PLACE',
      });
      expect(ranked(thirdPlace.b)?.position).toBe(4);
    });

    it('has no remaining attempts to fill with DNS', async () => {
      const semi = await sides(1);
      await start(semi.id).expect(200);
      await pointToA(semi.a, semi.b);
      const result = found(
        await db.result.findFirst({ where: { roundId, personId: semi.a } }),
        'result',
      );

      const res = await request(server())
        .post(`/result/${result.id}/assign-dns`)
        .set(as(users.DELEGATE))
        .expect(400);
      expect(res.body.message).toMatch(
        /^Head-to-head rounds have no remaining/,
      );
      expect(await attemptsOf(semi.a)).toHaveLength(1);
    });

    it('fills the final with both winners when the semifinals end at the same moment', async () => {
      const semi1 = await sides(1);
      const semi2 = await sides(2);
      await start(semi1.id).expect(200);
      await start(semi2.id).expect(200);
      for (let i = 0; i < 2; i++) {
        await pointToA(semi1.a, semi1.b);
        await pointToA(semi2.a, semi2.b);
      }
      await enter(semi1.b, 1100).expect(201);
      await enter(semi2.b, 1100).expect(201);

      // Each deciding attempt finishes its semifinal and writes the final
      await Promise.all([
        enter(semi1.a, 1000).expect(201),
        enter(semi2.a, 1000).expect(201),
      ]);

      const view = await getView();
      const final = matchOf(view, 4);
      const third = matchOf(view, 3);
      expect(final.status).toBe('READY');
      expect(third.status).toBe('READY');
      expect(
        [final.sideA, final.sideB]
          .map((side) => personOf(view, side.entrantId))
          .sort(),
      ).toEqual([semi1.a, semi2.a].sort());
    });

    it('offers a result for double check only once the competitor has no match left', async () => {
      await winForA(1);
      const semi2 = await sides(2);
      await start(semi2.id).expect(200);
      await pointToA(semi2.a, semi2.b);
      const listed = async () =>
        (
          (
            await request(server())
              .get(`/result/round/${roundId}/double-check`)
              .set(as(users.DELEGATE))
              .expect(200)
          ).body.results as { personId: string }[]
        ).map((r) => r.personId);

      // The loser of semifinal 1 still has the third-place match
      expect(await listed()).toEqual([]);

      const [playingAttempt] = await attemptsOf(semi2.a);
      const result = found(
        await db.result.findFirst({ where: { roundId, personId: semi2.a } }),
        'result',
      );
      const res = await request(server())
        .post('/result/double-check')
        .set(as(users.DELEGATE))
        .send({
          resultId: result.id,
          attempts: [
            {
              id: playingAttempt.id,
              attemptNumber: playingAttempt.attemptNumber,
              value: 1500,
              penalty: 0,
              status: 'STANDARD',
              type: 'STANDARD_ATTEMPT',
            },
          ],
        })
        .expect(409);
      expect(res.body.message).toMatch(/match still playing/);
    });

    it('re-decides a point when an attempt is edited during the match', async () => {
      const semi = await sides(1);
      await start(semi.id).expect(200);
      await pointToA(semi.a, semi.b);
      const [attemptA] = await attemptsOf(semi.a);

      await edit(attemptA as AttemptView, 1200).expect(200);

      const point = matchOf(await getView(), 1).sets[0].points[0];
      expect(point.attemptA?.value).toBe(1200);
      expect(point.winnerSide).toBe('B');
    });

    it('keeps the winners when an attempt is edited after the match', async () => {
      const semi = await winForA(1);
      const before = matchOf(await getView(), 1);
      const [attemptA] = await attemptsOf(semi.a);

      await edit(attemptA as AttemptView, 5000).expect(200);

      const after = matchOf(await getView(), 1);
      expect(after.sets[0].points[0].attemptA?.value).toBe(5000);
      expect(after.sets[0].points.map((p) => p.winnerSide)).toEqual(
        before.sets[0].points.map((p) => p.winnerSide),
      );
      expect(after.winnerSide).toBe('A');
      expect(after.status).toBe('FINISHED');
    });
  });

  describe('scrambles', () => {
    it("races the set's scrambles, then its extras, then a spare, never one twice", async () => {
      await setUpBracket();
      // 2 scrambles and 1 extra each; E is a spare
      await importSets(['A', 'B', 'C', 'D', 'E'], 2, 1);
      const semi = await sides(1);
      await start(semi.id).expect(200);

      await pointToA(semi.a, semi.b);
      // No winner: both DNF
      await enter(semi.a, 1000, -1).expect(201);
      await enter(semi.b, 1000, -1).expect(201);
      await pointToA(semi.a, semi.b);
      await pointToA(semi.a, semi.b);

      const match = matchOf(await getView(), 1);
      expect(match.status).toBe('FINISHED');
      expect(match.sets[0].points.map((p) => p.scramble)).toEqual([
        { set: 'A', num: 1, isExtra: false },
        { set: 'A', num: 2, isExtra: false },
        { set: 'A', num: 1, isExtra: true },
        { set: 'E', num: 1, isExtra: false },
      ]);
      const points = await db.h2hPoint.findMany({
        select: { scrambleId: true },
      });
      expect(new Set(points.map((p) => p.scrambleId)).size).toBe(points.length);
    });

    it('refuses to open a point when no scramble is left, and saves nothing', async () => {
      await setUpBracket();
      await importSets(['A', 'B', 'C', 'D'], 1, 0);
      const semi = await sides(1);
      await start(semi.id).expect(200);
      await pointToA(semi.a, semi.b);

      const res = await enter(semi.a, 1000).expect(409);
      expect(res.body.message).toMatch(
        /^Semifinal 1, set 1 has no scramble left for point 2\. Set A is used up and there is no spare set\. Import more scramble sets for /,
      );
      expect(await attemptsOf(semi.a)).toHaveLength(1);
      const match = matchOf(await getView(), 1);
      expect(match.scrambleInUse?.warning).toMatch(/No scramble is left/);
    });

    it('takes newly imported sets for a set that opened without one', async () => {
      await setUpBracket({ SEMIFINAL: 2, THIRD_PLACE: 2, FINAL: 2 });
      await importSets(['A', 'B']);
      const semi = await sides(1);
      await start(semi.id).expect(200);
      // 1-1 in sets: set 3 opens, and the plan has no set for it
      for (let i = 0; i < 3; i++) await pointToA(semi.a, semi.b);
      for (let i = 0; i < 3; i++) {
        await enter(semi.a, 1200).expect(201);
        await enter(semi.b, 1100).expect(201);
      }
      await enter(semi.a, 1000).expect(409);

      await importSets(['C']);
      // The Matches tab names the scramble the point will take
      expect(matchOf(await getView(), 1).scrambleInUse).toEqual({
        setNumber: 3,
        pointNumber: 1,
        scramble: {
          scrambleSetId: expect.any(String),
          set: 'C',
          num: 1,
          isExtra: false,
        },
        text: 'Semifinal 1 · set 3 · Set C, scramble 1',
        warning: null,
      });
      await enter(semi.a, 1000).expect(201);

      const set3 = matchOf(await getView(), 1).sets[2];
      expect(set3.scrambleSet?.set).toBe('C');
      expect(set3.points[0].scramble).toEqual({
        set: 'C',
        num: 1,
        isExtra: false,
      });
    });

    it('opens the next set on its planned set, and doesn’t plan sets for finished matches', async () => {
      await setUpBracket({
        SEMIFINAL: 2,
        THIRD_PLACE: 2,
        FINAL: 2,
      });
      // Only enough for the first semifinal's first two sets
      await importSets(['A', 'B']);
      const semi = await winForA(1, 2);

      let view = await getView();
      const played = matchOf(view, 1);
      expect(played.status).toBe('FINISHED');
      expect(played.sets.map((s) => s.scrambleSet?.set)).toEqual(['A', 'B']);
      expect(semi.id).toBe(played.id);

      await importSets(['C', 'D', 'E']);
      view = await getView();
      const letter = (id: string | null) =>
        view.scramblePlan.scrambleSets.find((s) => s.id === id)?.set ?? null;
      const rowsOf = (matchNumber: number) =>
        view.scramblePlan.rows
          .filter((row) => row.matchNumber === matchNumber)
          .map((row) => letter(row.scrambleSetId));
      expect(rowsOf(1)).toEqual(['A', 'B', null]);
      expect(rowsOf(2)).toEqual(['C', 'D', 'E']);
    });
  });

  describe('deleting what a match used', () => {
    let semi: Awaited<ReturnType<typeof sides>>;

    beforeEach(async () => {
      await setUpBracket();
      await importSets(['A', 'B', 'C', 'D']);
      semi = await sides(1);
      await start(semi.id).expect(200);
      await pointToA(semi.a, semi.b);
    });

    it('refuses an attempt that decided a point', async () => {
      const [attempt] = await attemptsOf(semi.a);
      const res = await request(server())
        .delete(`/attempt/${attempt.id}`)
        .set(as(users.DELEGATE))
        .expect(409);
      expect(res.body.message).toBe(
        "This attempt was raced in Semifinal 1, set 1, point 1, so it can't be deleted. Edit its time instead.",
      );
    });

    it('deletes the lone attempt of the open point, and the point with it', async () => {
      await enter(semi.a, 1000).expect(201);
      const [, lone] = await attemptsOf(semi.a);

      await request(server())
        .delete(`/attempt/${lone.id}`)
        .set(as(users.DELEGATE))
        .expect(200);

      expect(matchOf(await getView(), 1).sets[0].points).toHaveLength(1);
      expect(await attemptsOf(semi.a)).toHaveLength(1);
    });

    it('refuses the result, the raced scramble set and restarting the group', async () => {
      const result = found(
        await db.result.findFirst({ where: { roundId, personId: semi.a } }),
        'result',
      );
      const resultRes = await request(server())
        .delete(`/result/${result.id}`)
        .set(as(users.DELEGATE))
        .expect(409);
      expect(resultRes.body.message).toBe(
        "This result can't be deleted: it has attempts raced in Semifinal 1, set 1.",
      );

      const set = found(
        await db.scrambleSet.findFirst({ where: { roundId, set: 'A' } }),
        'set A',
      );
      const setRes = await request(server())
        .delete(`/scramble-set/${set.id}`)
        .set(as(users.DELEGATE))
        .expect(409);
      expect(setRes.body.message).toBe(
        "Set A has been raced in a head-to-head match, so it can't be deleted",
      );
      await request(server())
        .delete(`/scramble-set/round/${roundId}`)
        .set(as(users.DELEGATE))
        .expect(409);

      await request(server())
        .delete(`/result/group/${roundId}-g1/restart`)
        .set(as(users.DELEGATE))
        .expect(409);
      expect(await attemptsOf(semi.a)).toHaveLength(1);
    });
  });

  it("tells a socket in the round's room that the bracket changed", async () => {
    await setUpBracket();
    await importSets(['A', 'B', 'C', 'D']);
    const semi = await sides(1);
    const socket = await connectSocketIo(url, users.STAFF.token);
    sockets.push(socket);
    await joinRoom(gateway, socket, 'joinH2h', `h2h-${roundId}`, { roundId });

    const started = waitForEvent(
      socket,
      'h2hUpdated',
      (payload: { matchId: string | null }) => payload.matchId === semi.id,
    );
    await start(semi.id).expect(200);
    expect(await started).toEqual({ roundId, matchId: semi.id });

    const entered = waitForEvent(
      socket,
      'h2hUpdated',
      (payload: { matchId: string | null }) => payload.matchId === semi.id,
    );
    await enter(semi.a, 1000).expect(201);
    await entered;
  });
});
