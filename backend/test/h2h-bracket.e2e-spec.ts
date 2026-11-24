import { INestApplication } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import { CUMULATIVE_LIMIT_MESSAGE } from 'src/h2h/h2hRound';
import * as request from 'supertest';
import { Competition, Round } from 'wcif-helpers';

import { disconnectSeedDb, seedH2hBracket } from '../prisma/seed/seed-test';
import { H2hMatchStatus, Person, Prisma } from '../src/generated/prisma/client';
import { found } from '../src/test-utils/found';
import { createTestApp } from './helpers/app.helper';
import { listenOnLoopback } from './helpers/loopback.helper';
import {
  createRoleUsers,
  deleteSetupUsers,
  TestUser,
} from './helpers/setup-roles.helper';

const SUFFIX = 'h2h-bracket';

interface PlanRow {
  id: string;
  matchNumber: number;
  setNumber: number;
  scrambleSetId: string | null;
  locked: boolean;
}

interface View {
  cannotCreate: string | null;
  suggestedSize: number | null;
  notice?: string | null;
  bracket: {
    id: string;
    size: number;
    status: string;
    wcaRoundId: number | null;
    seedsLocked: boolean;
    stages: { stage: string; setsToWin: number; started: boolean }[];
    entrants: {
      id: string;
      seed: number;
      seedTieBroken: boolean;
      person: { id: string; registrantId: number };
    }[];
    matches: {
      id: string;
      matchNumber: number;
      stage: string;
      setsToWin: number;
      status: string;
      sideA: { entrantId: string | null };
      sideB: { entrantId: string | null };
    }[];
  } | null;
  scramblePlan: {
    plannedSets: number;
    instruction: string;
    rows: PlanRow[];
    scrambleSets: { id: string; set: string }[];
  } | null;
}

const scrambleSet = (roundId: string, set: string, count = 5) => ({
  roundId,
  set,
  scrambles: Array.from({ length: count }, (_, i) => ({
    num: i + 1,
    encryptedScramble: `encrypted-${roundId}-${set}-${i + 1}`,
    isExtra: false,
  })),
});

describe('Head-to-head bracket setup (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let users: Record<'ORGANIZER' | 'DELEGATE' | 'STAFF', TestUser>;
  let originalWcif: Prisma.JsonValue;
  let competitionId: string;
  /** The WCIF's head-to-head round, whatever the dummy WCA calls it */
  let roundId: string;
  let previousRoundId: string;
  /** People registered for the event, in registrant id order */
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
  const create = (body: object = {}, id = roundId) =>
    request(server()).post(`/h2h/${id}`).set(as(users.DELEGATE)).send(body);
  const importSets = (letters: string[], count = 5) =>
    request(server())
      .post('/scramble-set/import')
      .set(as(users.DELEGATE))
      .send({
        scrambleSets: letters.map((set) => scrambleSet(roundId, set, count)),
      })
      .expect(201);
  const letterOf = (view: View, setId: string | null) =>
    view.scramblePlan?.scrambleSets.find((s) => s.id === setId)?.set ?? null;
  const planLetters = (view: View) =>
    found(view.scramblePlan, 'plan').rows.map((row) =>
      letterOf(view, row.scrambleSetId),
    );

  /** Rewrites the stored WCIF's rounds; restored after each test */
  const patchRounds = async (patch: (round: Round) => Round) => {
    const wcif = originalWcif as unknown as Competition;
    await db.competition.update({
      where: { id: competitionId },
      data: {
        wcif: {
          ...wcif,
          events: wcif.events.map((event) => ({
            ...event,
            rounds: event.rounds.map(patch),
          })),
        } as unknown as Prisma.InputJsonValue,
      },
    });
  };
  /** The previous round's ranking: registrant ids by place */
  const rankPreviousRound = (rankings: [number, number][]) =>
    patchRounds((round) =>
      round.id === previousRoundId
        ? {
            ...round,
            results: rankings.map(([personId, ranking]) => ({
              personId,
              ranking,
              attempts: [],
              best: 1000 + ranking,
              average: 1200 + ranking,
            })),
          }
        : round,
    );

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    await listenOnLoopback(app);
    await deleteSetupUsers(db, SUFFIX);
    users = await createRoleUsers(app, db, SUFFIX);
    const competition = found(
      await db.competition.findFirst(),
      'seeded competition',
    );
    competitionId = competition.id;
    originalWcif = competition.wcif;
    const wcif = competition.wcif as unknown as Competition;
    const round = found(
      wcif.events.flatMap((e) => e.rounds).find((r) => r.format === 'h'),
      'a head-to-head round in the dummy WCA competition',
    );
    roundId = round.id;
    const eventId = roundId.split('-r')[0];
    previousRoundId = `${eventId}-r${Number(roundId.split('-r')[1]) - 1}`;
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
    expect(registered.length).toBeGreaterThanOrEqual(14);
  }, 30000);

  beforeEach(async () => {
    await db.h2hBracket.deleteMany();
    await db.scrambleSet.deleteMany({ where: { roundId } });
    await db.competition.update({
      where: { id: competitionId },
      data: { wcif: originalWcif as Prisma.InputJsonValue },
    });
  });

  afterAll(async () => {
    await db.h2hBracket.deleteMany();
    await db.result.deleteMany({ where: { roundId } });
    await db.scrambleSet.deleteMany({ where: { roundId } });
    await db.competition.update({
      where: { id: competitionId },
      data: { wcif: originalWcif as Prisma.InputJsonValue },
    });
    // Leave the bracket the seed gives, for whatever runs next
    await seedH2hBracket(originalWcif as unknown as Competition);
    await disconnectSeedDb();
    await deleteSetupUsers(db, SUFFIX);
    await app.close();
  }, 30000);

  describe('creating', () => {
    it('seeds from the previous ranking, limited to who advanced, and flags a broken tie', async () => {
      const ids = registered.map((p) => found(p.registrantId, 'registrant'));
      // 14 ranked; the 3rd place is shared; the top 12 advance
      await rankPreviousRound(
        ids
          .slice(0, 14)
          .map((id, i): [number, number] => [id, i === 3 ? 3 : i + 1]),
      );

      const res = await create({ size: 12 }).expect(201);
      const view = res.body as View;
      const bracket = found(view.bracket, 'bracket');

      expect(view.notice).toBeNull();
      expect(bracket.status).toBe('SEEDED');
      expect(bracket.size).toBe(12);
      const seeds = bracket.entrants.map((e) => e.person.registrantId);
      expect(seeds).toHaveLength(12);
      expect(seeds.slice(0, 2)).toEqual(ids.slice(0, 2));
      expect(seeds.slice(2, 4).sort()).toEqual(ids.slice(2, 4).sort());
      expect(seeds.slice(4)).toEqual(ids.slice(4, 12));
      expect(
        bracket.entrants.filter((e) => e.seedTieBroken).map((e) => e.seed),
      ).toEqual([3, 4]);
      // Stage of 12: 5v12, 6v11, 7v10, 8v9 are ready; seeds 1-4 wait
      expect(bracket.matches.map((m) => [m.stage, m.status])).toEqual([
        ...Array(4).fill(['STAGE_OF_12', 'READY']),
        ...Array(4).fill(['QUARTERFINAL', 'WAITING']),
        ['SEMIFINAL', 'WAITING'],
        ['SEMIFINAL', 'WAITING'],
        ['THIRD_PLACE', 'WAITING'],
        ['FINAL', 'WAITING'],
      ]);
      const plan = found(view.scramblePlan, 'plan');
      expect(plan.plannedSets).toBe(12);
      expect(plan.rows).toHaveLength(12);
      expect(plan.instruction).toContain('to 12 on the WCA website');
    });

    it('defaults the size to the advancement and creates an unseeded bracket without a ranking', async () => {
      const view = (await getView()) as View;
      expect(view.suggestedSize).toBe(12);

      const res = await create().expect(201);
      const created = res.body as View;
      const bracket = found(created.bracket, 'bracket');

      expect(bracket.size).toBe(12);
      expect(bracket.status).toBe('DRAFT');
      expect(bracket.entrants).toEqual([]);
      expect(created.notice).toContain(
        'has no ranking yet, so the bracket has no seeds',
      );
      expect(bracket.matches.every((m) => m.status === 'WAITING')).toBe(true);
    });

    it.each([
      ['a size that is not a bracket size', { size: 6 }],
      [
        'a final to fewer sets than the third-place match',
        { size: 8, setsToWin: { THIRD_PLACE: 2, FINAL: 1 } },
      ],
      [
        'a stage to fewer sets than the stage before',
        { size: 8, setsToWin: { QUARTERFINAL: 2, SEMIFINAL: 1 } },
      ],
    ])('refuses %s', async (_, body) => {
      await create(body).expect(400);
      expect(await db.h2hBracket.count()).toBe(0);
    });

    it('explains invalid sets to win', async () => {
      const res = await create({
        size: 8,
        setsToWin: { THIRD_PLACE: 2, FINAL: 1 },
      }).expect(400);

      expect(res.body.message).toBe(
        "Sets to win in the Final can't be lower than in the Third-place match",
      );
    });

    it('refuses a round that is not head to head', async () => {
      const res = await create({ size: 8 }, previousRoundId).expect(400);

      expect(res.body.message).toContain("isn't a head-to-head round");
    });

    it('refuses a head-to-head round that is not the last of its event', async () => {
      await patchRounds((round) =>
        round.id === previousRoundId ? { ...round, format: 'h' } : round,
      );

      const res = await create({ size: 8 }, previousRoundId).expect(400);

      expect(res.body.message).toContain('Only the last round of an event');
    });

    it('refuses an event that does not allow head to head', async () => {
      const wcif = originalWcif as unknown as Competition;
      const other = found(
        wcif.events.find((e) => e.id === '222'),
        'a 2x2x2 event',
      );
      const lastRound = other.rounds[other.rounds.length - 1].id;
      await patchRounds((round) =>
        round.id === lastRound ? { ...round, format: 'h' } : round,
      );

      const res = await create({ size: 8 }, lastRound).expect(400);

      expect(res.body.message).toBe(
        'Head-to-head rounds are only allowed in 3x3x3, 4x4x4, 3x3x3 Blindfolded and 3x3x3 One-Handed.',
      );
    });

    it('refuses a round with a cumulative time limit', async () => {
      await patchRounds((round) =>
        round.id === roundId
          ? {
              ...round,
              timeLimit: { centiseconds: 60000, cumulativeRoundIds: [roundId] },
            }
          : round,
      );

      const res = await create({ size: 8 }).expect(400);

      expect(res.body.message).toBe(CUMULATIVE_LIMIT_MESSAGE);
      expect((await getView()).cannotCreate).toBe(CUMULATIVE_LIMIT_MESSAGE);
    });

    it('refuses a second bracket for the round', async () => {
      await create({ size: 8 }).expect(201);

      await create({ size: 8 }).expect(409);
    });

    it('is for delegates and organisers only', async () => {
      await request(server())
        .post(`/h2h/${roundId}`)
        .set(as(users.STAFF))
        .send({ size: 8 })
        .expect(403);
      await request(server())
        .post(`/h2h/${roundId}`)
        .set(as(users.ORGANIZER))
        .send({ size: 8 })
        .expect(201);
      await request(server()).get(`/h2h/${roundId}`).expect(401);
    });
  });

  describe('seeds', () => {
    const putSeeds = (personIds: string[]) =>
      request(server())
        .put(`/h2h/${roundId}/seeds`)
        .set(as(users.DELEGATE))
        .send({ personIds });

    it('takes the seeds by hand, then marks the bracket seeded and its first matches ready', async () => {
      await create({ size: 4 }).expect(201);
      const four = registered.slice(0, 4).map((p) => p.id);

      await putSeeds(four.slice(0, 3)).expect(200);
      expect(found((await getView()).bracket, 'bracket').status).toBe('DRAFT');

      const res = await putSeeds(four).expect(200);
      const bracket = found((res.body as View).bracket, 'bracket');

      expect(bracket.status).toBe('SEEDED');
      const entrantOf = (seed: number) =>
        found(
          bracket.entrants.find((e) => e.seed === seed),
          `seed ${seed}`,
        );
      expect(entrantOf(1).person.id).toBe(four[0]);
      // Semifinals 1 v 4 and 2 v 3 (I2f), both ready
      expect(
        bracket.matches
          .slice(0, 2)
          .map((m) => [
            m.status,
            bracket.entrants.find((e) => e.id === m.sideA.entrantId)?.seed,
            bracket.entrants.find((e) => e.id === m.sideB.entrantId)?.seed,
          ]),
      ).toEqual([
        ['READY', 1, 4],
        ['READY', 2, 3],
      ]);
    });

    it('reorders the seeds, keeping the tie mark only where nobody moved', async () => {
      const ids = registered.map((p) => found(p.registrantId, 'registrant'));
      // Seeds 1 and 2 tied
      await rankPreviousRound([
        [ids[0], 1],
        [ids[1], 1],
        [ids[2], 3],
        [ids[3], 4],
        [ids[4], 5],
        [ids[5], 6],
        [ids[6], 7],
        [ids[7], 8],
      ]);
      const created = found(
        ((await create({ size: 8 }).expect(201)).body as View).bracket,
        'bracket',
      );
      const order = created.entrants.map((e) => e.person.id);

      // Seeds 3 and 4 swap; the tied pair stays
      const res = await putSeeds([
        order[0],
        order[1],
        order[3],
        order[2],
        ...order.slice(4),
      ]).expect(200);
      const bracket = found((res.body as View).bracket, 'bracket');

      expect(bracket.entrants.map((e) => e.person.id)).toEqual([
        order[0],
        order[1],
        order[3],
        order[2],
        ...order.slice(4),
      ]);
      expect(bracket.entrants.map((e) => e.seedTieBroken)).toEqual([
        true,
        true,
        ...Array(6).fill(false),
      ]);
      // Quarterfinal 2 is seed 4 against seed 5, now with the moved person
      const quarterfinal2 = bracket.matches[1];
      const seed4 = found(
        bracket.entrants.find((e) => e.seed === 4),
        'seed 4',
      );
      expect(quarterfinal2.sideA.entrantId).toBe(seed4.id);
      expect(seed4.person.id).toBe(order[2]);
    });

    it('replaces a competitor', async () => {
      await create({ size: 4 }).expect(201);
      await putSeeds(registered.slice(0, 4).map((p) => p.id)).expect(200);
      const swapped = [
        ...registered.slice(0, 3).map((p) => p.id),
        registered[5].id,
      ];

      const res = await putSeeds(swapped).expect(200);

      expect(
        found((res.body as View).bracket, 'bracket').entrants.map(
          (e) => e.person.id,
        ),
      ).toEqual(swapped);
    });

    it('refuses more competitors than places, or someone unknown', async () => {
      await create({ size: 4 }).expect(201);

      await putSeeds(registered.slice(0, 5).map((p) => p.id)).expect(400);
      await putSeeds([
        ...registered.slice(0, 3).map((p) => p.id),
        '00000000-0000-4000-8000-000000000000',
      ]).expect(400);
      await putSeeds([registered[0].id, registered[0].id]).expect(400);
    });

    it('locks the seeds once a match has started', async () => {
      await create({ size: 4 }).expect(201);
      const four = registered.slice(0, 4).map((p) => p.id);
      await putSeeds(four).expect(200);
      const bracket = found(await db.h2hBracket.findFirst(), 'bracket');
      await db.h2hMatch.updateMany({
        where: { bracketId: bracket.id, matchNumber: 1 },
        data: { status: H2hMatchStatus.IN_PROGRESS, startedAt: new Date() },
      });

      const res = await putSeeds([...four].reverse()).expect(409);

      expect(res.body.message).toBe(
        "The seeds can't change once a match has started",
      );
      expect(found((await getView()).bracket, 'bracket').seedsLocked).toBe(
        true,
      );
    });
  });

  describe('changing the bracket', () => {
    const put = (body: object) =>
      request(server())
        .put(`/h2h/${roundId}`)
        .set(as(users.DELEGATE))
        .send(body);

    it('stores the WCA round id, and clears it', async () => {
      await create({ size: 8 }).expect(201);

      await put({ wcaRoundId: 4321 }).expect(200);
      expect(found((await getView()).bracket, 'bracket').wcaRoundId).toBe(4321);
      await put({ wcaRoundId: null }).expect(200);
      expect(found((await getView()).bracket, 'bracket').wcaRoundId).toBeNull();
    });

    it('changes sets to win and grows the scramble plan to match', async () => {
      await create({ size: 8 }).expect(201);

      const res = await put({ setsToWin: { FINAL: 2 } }).expect(200);
      const view = res.body as View;

      expect(
        found(view.bracket, 'bracket').stages.map((s) => s.setsToWin),
      ).toEqual([1, 1, 1, 2]);
      const plan = found(view.scramblePlan, 'plan');
      expect(plan.plannedSets).toBe(10);
      expect(
        plan.rows
          .filter((row) => row.matchNumber === 8)
          .map((r) => r.setNumber),
      ).toEqual([1, 2, 3]);

      await put({ setsToWin: { FINAL: 1 } }).expect(200);
      expect(found((await getView()).scramblePlan, 'plan').rows).toHaveLength(
        8,
      );
    });

    it('refuses sets to win the rules forbid', async () => {
      await create({ size: 8 }).expect(201);

      await put({ setsToWin: { THIRD_PLACE: 3 } }).expect(400);
    });

    it('refuses to change a stage that has started', async () => {
      await create({ size: 8 }).expect(201);
      const bracket = found(await db.h2hBracket.findFirst(), 'bracket');
      await db.h2hMatch.updateMany({
        where: { bracketId: bracket.id, stage: 'QUARTERFINAL', matchNumber: 1 },
        data: { status: H2hMatchStatus.IN_PROGRESS, startedAt: new Date() },
      });

      const res = await put({
        setsToWin: { QUARTERFINAL: 2, SEMIFINAL: 2, THIRD_PLACE: 2, FINAL: 2 },
      }).expect(409);

      expect(res.body.message).toBe(
        "The Quarterfinal has started, so its sets to win can't change",
      );
      // Later stages can still change
      await put({ setsToWin: { FINAL: 3 } }).expect(200);
    });
  });

  describe('scramble plan', () => {
    const putPlan = (rows: { id: string; scrambleSetId: string | null }[]) =>
      request(server())
        .put(`/h2h/${roundId}/scrambles`)
        .set(as(users.DELEGATE))
        .send({ rows });

    it('matches sets imported before the bracket, in letter order', async () => {
      await importSets(['B', 'A', 'C']);

      const view = (await create({ size: 4 }).expect(201)).body as View;

      expect(planLetters(view)).toEqual(['A', 'B', 'C', null]);
    });

    it('matches sets imported after the bracket, keeping edited rows', async () => {
      await create({ size: 4 }).expect(201);
      await importSets(['A', 'B']);
      let view = await getView();
      expect(planLetters(view)).toEqual(['A', 'B', null, null]);

      // Swap the two semifinals' sets in one go
      const [first, second] = found(view.scramblePlan, 'plan').rows;
      view = (
        await putPlan([
          { id: first.id, scrambleSetId: second.scrambleSetId },
          { id: second.id, scrambleSetId: first.scrambleSetId },
        ]).expect(200)
      ).body;
      expect(planLetters(view)).toEqual(['B', 'A', null, null]);

      await importSets(['C', 'D', 'E']);

      expect(planLetters(await getView())).toEqual(['B', 'A', 'C', 'D']);
    });

    it('letters sets past Z in order', async () => {
      const letters = Array.from({ length: 28 }, (_, i) =>
        i < 26
          ? String.fromCharCode(65 + i)
          : `A${String.fromCharCode(39 + i)}`,
      );
      await importSets(letters, 1);

      const view = (
        await create({
          size: 16,
          setsToWin: {
            STAGE_OF_16: 1,
            QUARTERFINAL: 1,
            SEMIFINAL: 2,
            THIRD_PLACE: 3,
            FINAL: 3,
          },
        }).expect(201)
      ).body as View;

      expect(found(view.scramblePlan, 'plan').plannedSets).toBe(28);
      expect(planLetters(view).slice(24)).toEqual(['Y', 'Z', 'AA', 'AB']);
    });

    it('refuses a set planned for two rows', async () => {
      await importSets(['A', 'B']);
      const view = (await create({ size: 4 }).expect(201)).body as View;
      const [first, second] = found(view.scramblePlan, 'plan').rows;

      const res = await putPlan([
        { id: second.id, scrambleSetId: first.scrambleSetId },
      ]).expect(400);

      expect(res.body.message).toBe(
        'Set A can only be in one place in the plan, and it is planned for Semifinal 1, set 1 and Semifinal 2, set 1',
      );
    });

    it("refuses another round's set", async () => {
      await create({ size: 4 }).expect(201);
      const other = await db.scrambleSet.create({
        data: { roundId: previousRoundId, set: 'Z' },
      });
      const [row] = found((await getView()).scramblePlan, 'plan').rows;

      try {
        await putPlan([{ id: row.id, scrambleSetId: other.id }]).expect(400);
      } finally {
        await db.scrambleSet.delete({ where: { id: other.id } });
      }
    });

    it('locks a row that has been raced', async () => {
      await importSets(['A', 'B', 'C']);
      const view = (await create({ size: 4 }).expect(201)).body as View;
      const [first] = found(view.scramblePlan, 'plan').rows;
      const firstMatch = found(view.bracket, 'bracket').matches[0];
      await db.h2hSet.create({
        data: {
          matchId: firstMatch.id,
          setNumber: 1,
          scrambleSetId: first.scrambleSetId,
        },
      });
      const spare = found(
        found((await getView()).scramblePlan, 'plan').scrambleSets.find(
          (s) => s.set === 'C',
        ),
        'set C',
      );

      const res = await putPlan([
        { id: first.id, scrambleSetId: spare.id },
      ]).expect(409);

      expect(res.body.message).toBe(
        "Semifinal 1, set 1 has been raced, so its scramble set can't change",
      );
      expect(found((await getView()).scramblePlan, 'plan').rows[0].locked).toBe(
        true,
      );
    });

    it('fills the gap a deleted set leaves with a spare set', async () => {
      await importSets(['A', 'B', 'C', 'D', 'E']);
      const view = (await create({ size: 4 }).expect(201)).body as View;
      const [first] = found(view.scramblePlan, 'plan').rows;

      await request(server())
        .delete(`/scramble-set/${first.scrambleSetId}`)
        .set(as(users.DELEGATE))
        .expect(204);

      expect(planLetters(await getView())).toEqual(['E', 'B', 'C', 'D']);
    });
  });

  describe('deleting', () => {
    const remove = () =>
      request(server()).delete(`/h2h/${roundId}`).set(as(users.DELEGATE));

    it('deletes a bracket with no attempts', async () => {
      await create({ size: 8 }).expect(201);

      await remove().expect(204);

      expect((await getView()).bracket).toBeNull();
      expect(await db.h2hMatch.count()).toBe(0);
    });

    it('refuses once an attempt is linked to a point', async () => {
      const view = (await create({ size: 4 }).expect(201)).body as View;
      const match = found(view.bracket, 'bracket').matches[0];
      const result = await db.result.create({
        data: {
          personId: registered[0].id,
          eventId: roundId.split('-r')[0],
          roundId,
        },
      });
      const attempt = await db.attempt.create({
        data: { resultId: result.id, attemptNumber: 1, value: 1234 },
      });
      await db.h2hSet.create({
        data: {
          matchId: match.id,
          setNumber: 1,
          points: { create: { pointNumber: 1, attemptAId: attempt.id } },
        },
      });

      const res = await remove().expect(409);

      expect(res.body.message).toBe(
        "The bracket can't be deleted once attempts are recorded in its matches",
      );
      await db.h2hBracket.deleteMany();
      await db.result.delete({ where: { id: result.id } });
    });

    it('is for delegates and organisers only', async () => {
      await create({ size: 8 }).expect(201);

      await request(server())
        .delete(`/h2h/${roundId}`)
        .set(as(users.STAFF))
        .expect(403);
    });
  });
});
