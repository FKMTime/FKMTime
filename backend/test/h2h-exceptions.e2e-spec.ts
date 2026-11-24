import { INestApplication } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import { NO_MATCH_IN_PROGRESS } from 'src/h2h/h2hMatch.service';
import { SocketController } from 'src/socket/socket.controller';
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
  afterEnd: boolean;
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
  reopenRefusal: string | null;
}

interface View {
  bracket: {
    status: string;
    seedsLocked: boolean;
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
  /** Everyone registered for the event, for a bigger bracket */
  let registered: Person[];

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
    changes: { value?: number; status?: string; penalty?: number },
  ) =>
    request(server())
      .put(`/attempt/${attempt.id}`)
      .set(as(users.DELEGATE))
      .send({
        attemptNumber: attempt.attemptNumber,
        value: changes.value ?? attempt.value,
        penalty: changes.penalty ?? attempt.penalty,
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
  const retire = (
    matchId: string,
    side: 'A' | 'B',
    comment = 'Injured',
    user = users.DELEGATE,
  ) =>
    request(server())
      .post(`/h2h/match/${matchId}/retire`)
      .set(as(user))
      .send({ side, comment });
  const reopen = (
    matchId: string,
    comment = 'Times were typed wrong',
    user = users.DELEGATE,
  ) =>
    request(server())
      .post(`/h2h/match/${matchId}/reopen`)
      .set(as(user))
      .send({ comment });
  const deleteAttempt = (attemptId: string) =>
    request(server()).delete(`/attempt/${attemptId}`).set(as(users.DELEGATE));
  /** Attempts given an extra that hasn't been raced yet */
  const waitingForExtra = async (personId: string) =>
    (await attemptsOf(personId)).filter(
      (a) => a.status === 'EXTRA_GIVEN' && a.replacedBy === null,
    );
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
    await db.device.deleteMany({ where: { name: `${SUFFIX} station` } });
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
    registered = await db.person.findMany({
      where: { registrantId: { in: registrantIds } },
      orderBy: { registrantId: 'asc' },
    });
    seeds = registered.slice(0, 4);
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

      // Extra granted (both competitors) from another incident on it,
      // raised on a station, which hears it is resolved
      const station = await db.device.create({
        data: {
          name: `${SUFFIX} station`,
          espId: 910001,
          type: 'STATION',
          roomId: found(await db.room.findFirst(), 'room').id,
        },
      });
      await db.attempt.update({
        where: { id: attemptA.id },
        data: { deviceId: station.id },
      });
      await edit(attemptA, { status: 'UNRESOLVED' }).expect(200);
      const sent = jest.spyOn(
        app.get(SocketController),
        'sendResponseToAllSockets',
      );
      try {
        await extra(first.id).expect(200);
        expect(sent).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'IncidentResolved',
            data: expect.objectContaining({
              espId: 910001,
              shouldScanCards: false,
              attempt: expect.objectContaining({
                id: attemptA.id,
                status: 'EXTRA_GIVEN',
              }),
            }),
          }),
        );
      } finally {
        sent.mockRestore();
      }
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

    it('keeps the point and its extras when a re-race is deleted, so no scramble is raced twice', async () => {
      await setUpBracket();
      const semi = await sides(1);
      await start(semi.id);
      await point(semi.a, semi.b);
      const first = pointsOf(matchOf(await getView(), 1))[0];
      await extra(first.id).expect(200);
      // A races it again, but the result was typed for the wrong person
      await enter(semi.a, 1300).expect(201);
      const reraced = found(
        pointsOf(matchOf(await getView(), 1))[0].attemptA,
        're-race',
      );

      await deleteAttempt(reraced.id).expect(200);

      const kept = pointsOf(matchOf(await getView(), 1))[0];
      expect(kept).toMatchObject({
        id: first.id,
        attemptA: null,
        attemptB: null,
        scramble: { set: 'A', num: 1, isExtra: true },
      });
      expect(kept.extras).toHaveLength(1);
      // The replaced race waits for its extra again
      expect(await waitingForExtra(semi.a)).toHaveLength(1);

      await point(semi.a, semi.b);
      const view = matchOf(await getView(), 1);
      expect(pointsOf(view)[0].scramble).toMatchObject({ isExtra: true });
      await point(semi.a, semi.b);
      // Point 2 takes scramble 2: scramble 1 was raced on point 1 already
      expect(pointsOf(matchOf(await getView(), 1))[1].scramble).toEqual({
        set: 'A',
        num: 2,
        isExtra: false,
      });
      expect(await waitingForExtra(semi.a)).toHaveLength(0);
    });

    it('gives a second extra on the same point, then normal scrambles once the extras run out', async () => {
      await setUpBracket();
      const semi = await sides(1);
      await start(semi.id);
      await point(semi.a, semi.b);
      for (let i = 0; i < 3; i++) {
        const raced = pointsOf(matchOf(await getView(), 1))[0];
        await extra(raced.id).expect(200);
        await point(semi.a, semi.b);
      }

      const raced = pointsOf(matchOf(await getView(), 1))[0];
      expect(raced.extras).toHaveLength(3);
      // Set A has 2 extras; the third race takes its next normal scramble
      expect(raced.scramble).toEqual({ set: 'A', num: 2, isExtra: false });
      expect(await waitingForExtra(semi.a)).toHaveLength(0);
      expect((await attemptsOf(semi.a)).map((a) => a.replacedBy)).toEqual([
        2,
        3,
        4,
        null,
      ]);
    });

    it('races again the point that finished the match while nothing it fed has started', async () => {
      await setUpBracket();
      const semi1 = await winForA(1);
      const finished = matchOf(await getView(), 1);
      expect(finished.status).toBe('FINISHED');
      const deciding = pointsOf(finished)[2];

      await extra(deciding.id).expect(200);

      const view = await getView();
      expect(matchOf(view, 1)).toMatchObject({
        status: 'IN_PROGRESS',
        winnerSide: null,
        endedBy: null,
      });
      // The final takes its winner back
      expect(matchOf(view, 4).sideA.entrantId).toBeNull();
      expect(pointsOf(matchOf(view, 1))[2]).toMatchObject({
        attemptA: null,
        attemptB: null,
        scramble: { isExtra: true },
      });
      await point(semi1.a, semi1.b);
      expect(matchOf(await getView(), 1)).toMatchObject({
        status: 'FINISHED',
        winnerSide: 'A',
      });

      // Once a match it fed has started, its points stay as they are
      await winForA(2);
      await start(matchOf(await getView(), 4).id);
      const last = pointsOf(matchOf(await getView(), 1))[2];
      const refused = await extra(last.id).expect(409);
      expect(refused.body.message).toContain('Final, which follows from it');
    });

    it('says how to get an extra once the opponent has started the next point', async () => {
      await setUpBracket();
      const semi = await sides(1);
      await start(semi.id);
      await point(semi.a, semi.b);
      await enter(semi.b, 1000).expect(201);
      const first = pointsOf(matchOf(await getView(), 1))[0];

      const refused = await extra(first.id).expect(409);
      expect(refused.body.message).toContain('Delete that attempt first');
    });

    it('keeps the status of a replaced attempt, and lets its time be corrected', async () => {
      await setUpBracket();
      const semi = await sides(1);
      await start(semi.id);
      await point(semi.a, semi.b);
      await extra(pointsOf(matchOf(await getView(), 1))[0].id).expect(200);
      const [stored] = await attemptsOf(semi.a);
      const replaced = { ...stored, penalty: stored.penalty ?? 0 };

      const refused = await edit(replaced, { status: 'STANDARD' }).expect(400);
      expect(refused.body.message).toContain(
        'its status, number and type stay as they are',
      );
      await edit(replaced, { status: 'EXTRA_GIVEN', value: 1050 }).expect(200);
      const [edited] = await attemptsOf(semi.a);
      expect(edited).toMatchObject({ value: 1050, status: 'EXTRA_GIVEN' });
    });

    it('adds the reason to the comments already on the attempts', async () => {
      await setUpBracket();
      const semi = await sides(1);
      await start(semi.id);
      await point(semi.a, semi.b);
      const [raced] = await attemptsOf(semi.a);
      await db.attempt.update({
        where: { id: raced.id },
        data: { comment: 'Judge noted a pop' },
      });

      await extra(pointsOf(matchOf(await getView(), 1))[0].id).expect(200);

      const [a] = await attemptsOf(semi.a);
      const [b] = await attemptsOf(semi.b);
      expect(a.comment).toBe('Judge noted a pop\nThe scramble was wrong');
      expect(b.comment).toBe('The scramble was wrong');
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

    it('keeps the seeds once someone has withdrawn', async () => {
      await setUpBracket();
      const semi1 = await sides(1);
      await withdraw(semi1.id, 'B').expect(200);

      const refused = await request(server())
        .put(`/h2h/${roundId}/seeds`)
        .set(as(users.DELEGATE))
        .send({ personIds: [...seeds].reverse().map((p) => p.id) })
        .expect(409);
      expect(refused.body.message).toContain('once a competitor has withdrawn');
    });

    it('keeps the seeds once someone has withdrawn before any walkover', async () => {
      const twelve = registered.slice(0, 12);
      expect(twelve).toHaveLength(12);
      await request(server())
        .post(`/h2h/${roundId}`)
        .set(as(users.DELEGATE))
        .send({ size: 12, setsToWin: {} })
        .expect(201);
      await request(server())
        .put(`/h2h/${roundId}/seeds`)
        .set(as(users.DELEGATE))
        .send({ personIds: twelve.map((p) => p.id) })
        .expect(200);
      // Seed 1 waits in the quarterfinal for an opponent not known yet
      const view = await getView();
      const topSeed = entrantOf(view, twelve[0].id);
      const waiting = found(
        view.bracket.matches.find(
          (m) =>
            m.sideA.entrantId === topSeed.id ||
            m.sideB.entrantId === topSeed.id,
        ),
        'the top seed’s match',
      );
      expect(waiting.status).toBe('WAITING');
      const side = waiting.sideA.entrantId === topSeed.id ? 'A' : 'B';
      await withdraw(waiting.id, side).expect(200);
      const after = await getView();
      expect(matchOf(after, waiting.matchNumber).status).toBe('WAITING');
      expect(after.bracket.seedsLocked).toBe(true);

      const refused = await request(server())
        .put(`/h2h/${roundId}/seeds`)
        .set(as(users.DELEGATE))
        .send({ personIds: [...twelve].reverse().map((p) => p.id) })
        .expect(409);
      expect(refused.body.message).toContain('once a competitor has withdrawn');
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
      await retire(semi.id, 'A', 'Broken puzzle', users.STAGE_LEADER).expect(
        403,
      );
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

    it('calls off an extra not raced yet, so nothing waits for it', async () => {
      await setUpBracket();
      const semi = await sides(1);
      await start(semi.id);
      await point(semi.a, semi.b);
      await point(semi.a, semi.b);
      await extra(pointsOf(matchOf(await getView(), 1))[1].id).expect(200);

      await retire(semi.id, 'A', 'Left the venue').expect(200);

      for (const person of [semi.a, semi.b]) {
        expect(await waitingForExtra(person)).toHaveLength(0);
        const voided = (await attemptsOf(person)).filter(
          (a) => a.status === 'VOIDED',
        );
        expect(voided).toHaveLength(1);
        const logs = await db.attemptEditLog.findMany({
          where: { attemptId: voided[0].id },
        });
        expect(logs.map((log) => log.comment)).toContainEqual(
          expect.stringContaining('No longer needed'),
        );
      }
      // The one who retired is done, so double check offers their result
      const toCheck = await request(server())
        .get(`/result/round/${roundId}/double-check`)
        .set(as(users.DELEGATE))
        .expect(200);
      expect(
        toCheck.body.results.map(
          (r: { person: { id: string } }) => r.person.id,
        ),
      ).toContain(semi.a);

      // Reopening the retirement puts the extra back
      await reopen(semi.id, 'Retired by mistake').expect(200);
      expect(await waitingForExtra(semi.a)).toHaveLength(1);
      expect(await waitingForExtra(semi.b)).toHaveLength(1);
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
      await reopen(semi1.id, 'Fraud', users.STAGE_LEADER).expect(403);
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

    it('leaves alone a withdrawal from a later match when a played one is reopened', async () => {
      await setUpBracket();
      const semi = await sides(1);
      await start(semi.id);
      await point(semi.a, semi.b);
      // A retirement undone earlier leaves its log behind
      await retire(semi.id, 'B').expect(200);
      await reopen(semi.id, 'Retired by mistake').expect(200);
      await point(semi.a, semi.b);
      await point(semi.a, semi.b);
      expect(matchOf(await getView(), 1).endedBy).toBe('PLAYED');
      // The loser then withdraws from the third-place match
      await withdraw(matchOf(await getView(), 3).id, 'B').expect(200);

      await reopen(semi.id).expect(200);

      const view = await getView();
      expect(matchOf(view, 1)).toMatchObject({
        status: 'FINISHED',
        winnerSide: 'A',
      });
      expect(entrantOf(view, semi.b).withdrawnAt).not.toBeNull();
      expect(matchOf(view, 1).reopenRefusal).toBeNull();
    });

    it('undoes a withdrawal only in the match where it happened', async () => {
      await setUpBracket();
      const semi1 = await sides(1);
      await withdraw(semi1.id, 'B').expect(200);
      await winForA(2);
      const view = await getView();
      expect(matchOf(view, 3).endedBy).toBe('WALKOVER');
      expect(matchOf(view, 3).reopenRefusal).toContain(
        'withdrew in Semifinal 1',
      );

      const refused = await reopen(matchOf(view, 3).id).expect(409);
      expect(refused.body.message).toContain('Reopen Semifinal 1 instead');

      await reopen(semi1.id, 'Withdrew by mistake').expect(200);
      const after = await getView();
      expect(entrantOf(after, semi1.b).withdrawnAt).toBeNull();
      expect(matchOf(after, 1).status).toBe('READY');
      expect(matchOf(after, 3).status).toBe('WAITING');
    });

    it('leaves out points raced after the set was over on amended times', async () => {
      await setUpBracket();
      const semi = await sides(1);
      await start(semi.id);
      await point(semi.a, semi.b, 1000, 1100);
      await point(semi.a, semi.b, 1000, 1100);
      await point(semi.a, semi.b, 1200, 1100);
      await point(semi.a, semi.b, 1000, 1100);
      expect(matchOf(await getView(), 1).winnerSide).toBe('A');
      // B's point-3 solve turns out to be a DNF
      const third = pointsOf(matchOf(await getView(), 1))[2];
      await edit(found(third.attemptB, 'attempt'), { penalty: -1 }).expect(200);

      await reopen(semi.id, 'Point 3 was a DNF').expect(200);

      const reopened = matchOf(await getView(), 1);
      expect(reopened).toMatchObject({ status: 'FINISHED', winnerSide: 'A' });
      expect(pointsOf(reopened).map((p) => [p.winnerSide, p.decided])).toEqual([
        ['A', true],
        ['A', true],
        ['A', true],
        [null, false],
      ]);
      // Point 4 doesn't count, so it can't be raced again
      const surplus = pointsOf(reopened)[3];
      expect(surplus.afterEnd).toBe(true);
      const refused = await extra(surplus.id).expect(409);
      expect(refused.body.message).toContain("doesn't count");
      expect(await waitingForExtra(semi.a)).toHaveLength(0);
    });

    it('calls off an extra on a point that turns out to come after the end', async () => {
      await setUpBracket();
      const semi = await sides(1);
      await start(semi.id);
      await point(semi.a, semi.b, 1000, 1100);
      await point(semi.a, semi.b, 1000, 1100);
      await point(semi.a, semi.b, 1200, 1100);
      await point(semi.a, semi.b, 1200, 1100);
      const fourth = pointsOf(matchOf(await getView(), 1))[3];
      await extra(fourth.id).expect(200);
      await retire(semi.id, 'B', 'Left the venue').expect(200);
      // B's point-3 solve turns out to be a DNF: A had the set at point 3
      const third = pointsOf(matchOf(await getView(), 1))[2];
      await edit(found(third.attemptB, 'attempt'), { penalty: -1 }).expect(200);

      await reopen(semi.id, 'Point 3 was a DNF').expect(200);

      const reopened = matchOf(await getView(), 1);
      expect(reopened).toMatchObject({
        status: 'FINISHED',
        winnerSide: 'A',
        endedBy: 'PLAYED',
      });
      expect(pointsOf(reopened)[3].afterEnd).toBe(true);
      // Nothing waits for an extra that will never be raced
      expect(await waitingForExtra(semi.a)).toHaveLength(0);
      expect(await waitingForExtra(semi.b)).toHaveLength(0);
    });

    it('still refuses a mid-match edit that ends a set early once reopened', async () => {
      await setUpBracket();
      const semi = await sides(1);
      await start(semi.id);
      await point(semi.a, semi.b, 1000, 1100);
      await point(semi.a, semi.b, 1000, 1100);
      await retire(semi.id, 'B').expect(200);
      await reopen(semi.id, 'Retired by mistake').expect(200);
      await point(semi.a, semi.b, 1200, 1100);
      await point(semi.a, semi.b, 1200, 1100);
      const third = pointsOf(matchOf(await getView(), 1))[2];

      const refused = await edit(found(third.attemptB, 'attempt'), {
        penalty: -1,
      }).expect(409);
      expect(refused.body.message).toContain('Check the times');
    });

    it('reopens a walkover a withdrawal moved to, once its match no longer has the competitor', async () => {
      await setUpBracket();
      const semi1 = await winForA(1);
      // The winner withdraws from the final before its other side is known
      await withdraw(matchOf(await getView(), 4).id, 'A').expect(200);
      // Then semifinal 1 is reopened on amended times, and its loser wins
      for (const p of pointsOf(matchOf(await getView(), 1))) {
        await edit(found(p.attemptB, 'attempt'), { value: 900 }).expect(200);
      }
      await reopen(semi1.id).expect(200);
      await winForA(2);
      const view = await getView();
      const third = matchOf(view, 3);
      expect(third.endedBy).toBe('WALKOVER');
      expect(personOf(view, third.sideB.entrantId)).toBe(semi1.a);
      expect(third.reopenRefusal).toBeNull();

      await reopen(third.id, 'Withdrew by mistake').expect(200);

      expect(entrantOf(await getView(), semi1.a).withdrawnAt).toBeNull();
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
