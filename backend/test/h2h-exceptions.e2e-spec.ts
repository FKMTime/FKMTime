import { INestApplication } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import { NO_MATCH_IN_PROGRESS } from 'src/h2h/h2hMatch.service';
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

const SUFFIX = 'h2h-exceptions';

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
  extras: { attemptA: AttemptView; attemptB: AttemptView }[];
  amendedAfterMatch: boolean;
  scramble: { set: string; num: number; isExtra: boolean } | null;
}

interface MatchView {
  id: string;
  matchNumber: number;
  status: string;
  winnerSide: 'A' | 'B' | null;
  endedBy: string | null;
  sideA: { entrantId: string | null };
  sideB: { entrantId: string | null };
  sets: {
    setNumber: number;
    winnerSide: 'A' | 'B' | null;
    points: PointView[];
  }[];
  scrambleInUse: { text: string } | null;
  log: { action: string; side: string | null; comment: string | null }[];
}

interface View {
  bracket: {
    status: string;
    entrants: {
      id: string;
      person: { id: string };
      withdrawnAt: string | null;
      position: number | null;
      bestSingle: number | null;
    }[];
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
 * What a delegate does to a head-to-head match besides its points
 * (SPEC-001): Extra granted, Withdraw, Retire, Reopen match, and times
 * amended after the match
 */
describe('Head-to-head match exceptions (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let users: Record<'DELEGATE' | 'STAGE_LEADER' | 'STAFF', TestUser>;
  let originalWcif: Prisma.JsonValue;
  let roundId: string;
  /** Four people registered for the event: seeds 1 to 4 */
  let seeds: Person[];

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
  const entrantOf = (view: View, personId: string) =>
    found(
      view.bracket.entrants.find((e) => e.person.id === personId),
      'entrant',
    );
  const personOf = (view: View, entrantId: string | null) =>
    found(
      view.bracket.entrants.find((e) => e.id === entrantId),
      'entrant',
    ).person.id;
  const pointsOf = (match: MatchView, setNumber = 1) =>
    found(
      match.sets.find((set) => set.setNumber === setNumber),
      `set ${setNumber}`,
    ).points;
  const start = (matchId: string) =>
    request(server())
      .post(`/h2h/match/${matchId}/start`)
      .set(as(users.STAGE_LEADER))
      .expect(200);
  /** Manual entry; the attempt number given is ignored for these rounds */
  const enter = (personId: string, value: number) =>
    request(server()).post('/attempt').set(as(users.DELEGATE)).send({
      attemptNumber: 99,
      value,
      penalty: 0,
      roundId,
      competitorId: personId,
      status: 'STANDARD',
      type: 'STANDARD_ATTEMPT',
    });
  const edit = (
    attempt: AttemptView & { type?: string },
    changes: { value?: number; status?: string },
  ) =>
    request(server())
      .put(`/attempt/${attempt.id}`)
      .set(as(users.DELEGATE))
      .send({
        attemptNumber: attempt.attemptNumber,
        value: changes.value ?? attempt.value,
        penalty: attempt.penalty,
        status: changes.status ?? 'STANDARD',
        type: attempt.type ?? 'STANDARD_ATTEMPT',
      });
  const extra = (pointId: string, user = users.DELEGATE) =>
    request(server())
      .post(`/h2h/point/${pointId}/extra`)
      .set(as(user))
      .send({ comment: 'The scramble was wrong' });
  const withdraw = (matchId: string, side: 'A' | 'B', user = users.DELEGATE) =>
    request(server())
      .post(`/h2h/match/${matchId}/withdraw`)
      .set(as(user))
      .send({ side });
  const retire = (matchId: string, side: 'A' | 'B', comment = 'Injured') =>
    request(server())
      .post(`/h2h/match/${matchId}/retire`)
      .set(as(users.DELEGATE))
      .send({ side, comment });
  const reopen = (matchId: string, comment = 'Times were typed wrong') =>
    request(server())
      .post(`/h2h/match/${matchId}/reopen`)
      .set(as(users.DELEGATE))
      .send({ comment });
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
  const point = async (a: string, b: string, timeA = 1000, timeB = 1100) => {
    await enter(a, timeA).expect(201);
    await enter(b, timeB).expect(201);
  };
  /** Plays a match to 3 points for A in one set */
  const winForA = async (matchNumber: number) => {
    const match = await sides(matchNumber);
    await start(match.id);
    for (let i = 0; i < 3; i++) await point(match.a, match.b);
    return match;
  };
  const attemptsOf = (personId: string) =>
    db.attempt.findMany({
      where: { result: { personId, roundId } },
      orderBy: { attemptNumber: 'asc' },
    });

  /** A fresh 4-competitor bracket with sets A to H to race on */
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
    await request(server())
      .post('/scramble-set/import')
      .set(as(users.DELEGATE))
      .send({
        scrambleSets: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((set) =>
          scrambleSet(roundId, set),
        ),
      })
      .expect(201);
  };

  const clean = async () => {
    // Points hold their attempts and scrambles, so the bracket goes first
    await db.h2hBracket.deleteMany();
    await db.result.deleteMany({ where: { roundId } });
    await db.scrambleSet.deleteMany({ where: { roundId } });
  };

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
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

  afterAll(async () => {
    await clean();
    // Leave the bracket the seed gives, for whatever runs next
    await seedH2hBracket(originalWcif as unknown as Competition);
    await disconnectSeedDb();
    await deleteSetupUsers(db, SUFFIX);
    await app.close();
  }, 30000);

  describe('Extra granted', () => {
    it('marks both attempts Extra granted and races the point again on an extra scramble', async () => {
      await setUpBracket();
      const semi = await sides(1);
      await start(semi.id);
      await point(semi.a, semi.b);
      const decided = pointsOf(matchOf(await getView(), 1))[0];
      expect(decided.winnerSide).toBe('A');

      await extra(decided.id, users.STAGE_LEADER).expect(403);
      await extra(decided.id).expect(200);

      const [replacedA] = await attemptsOf(semi.a);
      const [replacedB] = await attemptsOf(semi.b);
      for (const attempt of [replacedA, replacedB]) {
        expect(attempt).toMatchObject({
          status: 'EXTRA_GIVEN',
          replacedBy: null,
          comment: 'The scramble was wrong',
        });
      }
      const cleared = pointsOf(matchOf(await getView(), 1))[0];
      expect(cleared).toMatchObject({
        pointNumber: 1,
        attemptA: null,
        attemptB: null,
        decided: false,
        winnerSide: null,
        scramble: { set: 'A', num: 1, isExtra: true },
      });
      expect(cleared.extras).toHaveLength(1);
      expect(cleared.extras[0].attemptA.id).toBe(replacedA.id);

      // The next two submissions race it again; this time B is faster
      await point(semi.a, semi.b, 1300, 1200);
      const raced = matchOf(await getView(), 1);
      expect(pointsOf(raced)[0]).toMatchObject({
        winnerSide: 'B',
        attemptA: { attemptNumber: 2, value: 1300 },
      });
      const after = await attemptsOf(semi.a);
      expect(after.map((a) => [a.attemptNumber, a.type, a.replacedBy])).toEqual(
        [
          [1, 'STANDARD_ATTEMPT', 2],
          [2, 'EXTRA_ATTEMPT', null],
        ],
      );
      // Point 2 goes on with the set's next normal scramble
      expect(raced.scrambleInUse?.text).toBe(
        'Semifinal 1 · set 1 · Set A, scramble 2',
      );
    });

    it('refuses an extra before both results are in, and on a point another followed', async () => {
      await setUpBracket();
      const semi = await sides(1);
      await start(semi.id);
      await enter(semi.a, 1000).expect(201);
      const open = pointsOf(matchOf(await getView(), 1))[0];
      const lone = await extra(open.id).expect(409);
      expect(lone.body.message).toContain('Both results of Semifinal 1');

      await enter(semi.b, 1100).expect(201);
      await point(semi.a, semi.b);
      const followed = await extra(open.id).expect(409);
      expect(followed.body.message).toContain('Only the last point raced');
    });

    it('opens again the set its point decided', async () => {
      await setUpBracket({ SEMIFINAL: 2, THIRD_PLACE: 2, FINAL: 2 });
      const semi = await sides(1);
      await start(semi.id);
      for (let i = 0; i < 3; i++) await point(semi.a, semi.b);
      const before = matchOf(await getView(), 1);
      expect(before.sets.map((s) => s.winnerSide)).toEqual(['A', null]);

      await extra(pointsOf(before)[2].id).expect(200);

      const after = matchOf(await getView(), 1);
      expect(after.sets.map((s) => s.winnerSide)).toEqual([null]);
      // Both race point 3 again, in set 1
      await point(semi.a, semi.b, 1200, 1100);
      const raced = matchOf(await getView(), 1);
      expect(pointsOf(raced)[2].winnerSide).toBe('B');
      expect(raced.sets).toHaveLength(1);
    });

    it('resolves an incident on a point with an extra for both, or with no extra', async () => {
      await setUpBracket();
      const semi = await sides(1);
      await start(semi.id);
      await point(semi.a, semi.b);
      const first = pointsOf(matchOf(await getView(), 1))[0];
      const attemptA = found(first.attemptA, 'attempt A');
      await edit(attemptA, { status: 'UNRESOLVED' }).expect(200);

      // The incident screen learns the point from the attempt
      const incident = await request(server())
        .get(`/attempt/${attemptA.id}`)
        .set(as(users.DELEGATE))
        .expect(200);
      expect(incident.body.attempt.h2hPointId).toBe(first.id);

      // The generic single-competitor extra paths point to the point's
      const single = await edit(attemptA, { status: 'EXTRA_GIVEN' }).expect(
        400,
      );
      expect(single.body.message).toContain(
        'Use Extra granted on the point in the Matches tab',
      );
      await request(server())
        .put(`/attempt/${attemptA.id}/replacement`)
        .set(as(users.DELEGATE))
        .send({ replacedByExtraNumber: 1 })
        .expect(409);

      // No extra: the attempt counts as it is
      await edit(attemptA, { status: 'RESOLVED' }).expect(200);
      expect(pointsOf(matchOf(await getView(), 1))[0].winnerSide).toBe('A');

      // Extra granted (both competitors) from another incident on it
      await edit(attemptA, { status: 'UNRESOLVED' }).expect(200);
      await extra(first.id).expect(200);
      const [a] = await attemptsOf(semi.a);
      const [b] = await attemptsOf(semi.b);
      expect([a.status, b.status]).toEqual(['EXTRA_GIVEN', 'EXTRA_GIVEN']);
    });

    it('refuses to reorder, swap or delete attempts raced on a point', async () => {
      await setUpBracket();
      const semi = await sides(1);
      await start(semi.id);
      await point(semi.a, semi.b);
      await point(semi.a, semi.b);
      const [first, second] = await attemptsOf(semi.a);

      const reorder = await request(server())
        .put('/attempt/reorder')
        .set(as(users.DELEGATE))
        .send({ resultId: first.resultId, attemptIds: [second.id, first.id] })
        .expect(409);
      expect(reorder.body.message).toContain('keep the order of their points');
      await request(server())
        .put('/attempt/swap')
        .set(as(users.DELEGATE))
        .send({ firstAttemptId: first.id, secondAttemptId: second.id })
        .expect(409);

      // A race replaced by an extra stays as its record
      const view = await getView();
      await extra(pointsOf(matchOf(view, 1))[1].id).expect(200);
      const deleted = await request(server())
        .delete(`/attempt/${second.id}`)
        .set(as(users.DELEGATE))
        .expect(409);
      expect(deleted.body.message).toContain('replaced by an extra');
    });
  });

  describe('Withdraw', () => {
    it('gives the opponent a walkover, and the withdrawn competitor’s third-place match too', async () => {
      await setUpBracket();
      const semi1 = await sides(1);

      await withdraw(semi1.id, 'B', users.STAGE_LEADER).expect(403);
      await withdraw(semi1.id, 'B').expect(200);

      const view = await getView();
      expect(matchOf(view, 1)).toMatchObject({
        status: 'FINISHED',
        endedBy: 'WALKOVER',
        winnerSide: 'A',
      });
      expect(entrantOf(view, semi1.b).withdrawnAt).not.toBeNull();
      const final = matchOf(view, 4);
      expect(personOf(view, final.sideA.entrantId)).toBe(semi1.a);
      // The third-place match waits for the other semifinal's loser
      expect(matchOf(view, 3).status).toBe('WAITING');
      await enter(semi1.b, 1000).expect(409);

      const semi2 = await winForA(2);
      const after = await getView();
      expect(matchOf(after, 3)).toMatchObject({
        status: 'FINISHED',
        endedBy: 'WALKOVER',
      });
      expect(personOf(after, matchOf(after, 3).sideA.entrantId)).toBe(semi2.b);
      expect(matchOf(after, 3).winnerSide).toBe('A');

      await winForA(4);
      const done = await getView();
      expect(done.bracket.status).toBe('FINISHED');
      // No attempts at all: no position (9f5b)
      expect(entrantOf(done, semi1.b).position).toBeNull();
      expect(entrantOf(done, semi2.b).position).toBe(3);
    });

    it('refuses a match that has started: that is Retire', async () => {
      await setUpBracket();
      const semi = await sides(1);
      await start(semi.id);
      const refused = await withdraw(semi.id, 'A').expect(409);
      expect(refused.body.message).toContain('use Retire');
    });
  });

  describe('Retire', () => {
    it('keeps decided points and every attempt, and the opponent advances', async () => {
      await setUpBracket();
      const semi = await sides(1);
      await start(semi.id);
      await point(semi.a, semi.b, 1000, 1100);
      await point(semi.a, semi.b, 1200, 1100);
      await enter(semi.a, 1000).expect(201);

      await retire(semi.id, 'A', '  ').expect(400);
      await retire(semi.id, 'A', 'Broken puzzle').expect(200);

      const view = await getView();
      const retired = matchOf(view, 1);
      expect(retired).toMatchObject({
        status: 'FINISHED',
        endedBy: 'RETIRED',
        winnerSide: 'B',
      });
      expect(retired.log).toEqual([
        expect.objectContaining({
          action: 'RETIRE',
          side: 'A',
          comment: 'Broken puzzle',
        }),
      ]);
      expect(retired.sets[0].winnerSide).toBeNull();
      expect(pointsOf(retired).map((p) => [p.winnerSide, p.decided])).toEqual([
        ['A', true],
        ['B', true],
        [null, false],
      ]);
      expect(pointsOf(retired)[2].attemptA?.value).toBe(1000);
      expect(await attemptsOf(semi.a)).toHaveLength(3);
      expect(personOf(view, matchOf(view, 4).sideA.entrantId)).toBe(semi.b);
      const refused = await enter(semi.a, 1000).expect(409);
      expect(refused.body.message).toBe(NO_MATCH_IN_PROGRESS);

      // Their third-place match is a walkover once its other side is known
      await winForA(2);
      expect(matchOf(await getView(), 3).endedBy).toBe('WALKOVER');
    });

    it('counts a retirement before the competitor’s first attempt as a walkover', async () => {
      await setUpBracket();
      const semi = await sides(1);
      await start(semi.id);
      await enter(semi.b, 1000).expect(201);

      await retire(semi.id, 'A').expect(200);

      const view = await getView();
      expect(matchOf(view, 1)).toMatchObject({
        endedBy: 'WALKOVER',
        winnerSide: 'B',
      });
      // A walkover's attempts don't count: B has no single yet
      expect(entrantOf(view, semi.b).bestSingle).toBeNull();
      expect(entrantOf(view, semi.a).withdrawnAt).not.toBeNull();
    });
  });

  describe('Reopen match and times amended after the match', () => {
    it('keeps the winner after an edit and marks the point', async () => {
      await setUpBracket();
      const semi = await winForA(1);
      const before = pointsOf(matchOf(await getView(), 1));

      await edit(found(before[0].attemptA, 'attempt'), { value: 5000 }).expect(
        200,
      );

      const after = matchOf(await getView(), 1);
      expect(after.winnerSide).toBe('A');
      expect(
        pointsOf(after).map((p) => [p.winnerSide, p.amendedAfterMatch]),
      ).toEqual([
        ['A', true],
        ['A', false],
        ['A', false],
      ]);
      const [edited] = await attemptsOf(semi.a);
      expect(edited.value).toBe(5000);
    });

    it('decides the match again from amended times, and refuses once a match it fed has started', async () => {
      await setUpBracket();
      const semi1 = await winForA(1);
      for (const p of pointsOf(matchOf(await getView(), 1))) {
        await edit(found(p.attemptB, 'attempt'), { value: 900 }).expect(200);
      }

      await reopen(semi1.id, '').expect(400);
      await reopen(semi1.id).expect(200);

      const view = await getView();
      const reopened = matchOf(view, 1);
      expect(reopened).toMatchObject({ status: 'FINISHED', winnerSide: 'B' });
      expect(reopened.log.map((entry) => entry.action)).toEqual(['REOPEN']);
      expect(pointsOf(reopened).every((p) => !p.amendedAfterMatch)).toBe(true);
      expect(personOf(view, matchOf(view, 4).sideA.entrantId)).toBe(semi1.b);
      expect(personOf(view, matchOf(view, 3).sideB.entrantId)).toBe(semi1.a);

      await winForA(2);
      await start(matchOf(await getView(), 4).id);
      const refused = await reopen(semi1.id).expect(409);
      expect(refused.body.message).toContain('Final, which follows from it');
    });

    it('undoes a mistaken Retire', async () => {
      await setUpBracket();
      const semi = await sides(1);
      await start(semi.id);
      await point(semi.a, semi.b);
      await retire(semi.id, 'B').expect(200);

      await reopen(semi.id, 'Retired by mistake').expect(200);

      const view = await getView();
      expect(matchOf(view, 1)).toMatchObject({
        status: 'IN_PROGRESS',
        winnerSide: null,
        endedBy: null,
      });
      expect(entrantOf(view, semi.b).withdrawnAt).toBeNull();
      expect(matchOf(view, 4).sideA.entrantId).toBeNull();
      // The match goes on where it stopped
      await point(semi.a, semi.b);
      await point(semi.a, semi.b);
      expect(matchOf(await getView(), 1).winnerSide).toBe('A');
    });
  });
});
