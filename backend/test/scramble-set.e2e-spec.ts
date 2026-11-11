import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';

import { createTestApp } from './helpers/app.helper';
import { listenOnLoopback } from './helpers/loopback.helper';
import {
  createUserWithRoles,
  deleteSetupUsers,
  TestUser,
} from './helpers/setup-roles.helper';

const SUFFIX = 'scramble-set';
const FAKE_ID = '00000000-0000-4000-8000-000000000000';

const scrambleSet = (roundId: string, set: string, count = 5, extra = 2) => ({
  roundId,
  set,
  scrambles: [
    ...Array.from({ length: count }, (_, i) => ({
      num: i + 1,
      encryptedScramble: `encrypted-${roundId}-${set}-${i + 1}`,
      isExtra: false,
    })),
    ...Array.from({ length: extra }, (_, i) => ({
      num: i + 1,
      encryptedScramble: `encrypted-${roundId}-${set}-extra-${i + 1}`,
      isExtra: true,
    })),
  ],
});

describe('ScrambleSetController (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let adminToken: string;
  let delegate: TestUser;

  const server = () => app.getHttpServer();
  const asDelegate = (req: request.Test) =>
    req.set('Authorization', `Bearer ${delegate.token}`);
  const importSets = (sets: ReturnType<typeof scrambleSet>[]) =>
    asDelegate(request(server()).post('/scramble-set/import')).send({
      scrambleSets: sets,
    });

  beforeAll(async () => {
    ({ app, db, adminToken } = await createTestApp());
    await listenOnLoopback(app);
    await deleteSetupUsers(db, SUFFIX);
    delegate = await createUserWithRoles(app, db, `delegate-${SUFFIX}`, [
      Role.DELEGATE,
    ]);
    await db.scrambleSet.deleteMany();
  }, 30000);

  afterAll(async () => {
    await db.scrambleSet.deleteMany();
    await deleteSetupUsers(db, SUFFIX);
    await app.close();
  }, 30000);

  describe('POST /scramble-set/import', () => {
    it('imports several sets with their scrambles', async () => {
      const res = await importSets([
        scrambleSet('333-r1', 'A'),
        scrambleSet('333-r1', 'B'),
        scrambleSet('666-r1', 'A', 3, 1),
      ]).expect(201);

      expect(res.body).toEqual({ message: 'Scrambles imported successfully' });
      const sets = await db.scrambleSet.findMany({
        include: { scrambles: true },
        orderBy: [{ roundId: 'asc' }, { set: 'asc' }],
      });
      expect(sets.map((s) => [s.roundId, s.set, s.scrambles.length])).toEqual([
        ['333-r1', 'A', 7],
        ['333-r1', 'B', 7],
        ['666-r1', 'A', 4],
      ]);
      const extra = sets[0].scrambles.find((s) => s.isExtra && s.num === 2);
      expect(extra.encryptedScramble).toBe('encrypted-333-r1-A-extra-2');
    });

    it('rejects a set that was already imported', async () => {
      const res = await importSets([scrambleSet('333-r1', 'A')]).expect(400);

      expect(res.body.message).toBe(
        '3x3x3 Cube, Round 1 set A has already been imported',
      );
      expect(await db.scrambleSet.count({ where: { roundId: '333-r1' } })).toBe(
        2,
      );
    });

    it('imports nothing when one of the sets is a duplicate', async () => {
      await importSets([
        scrambleSet('333-r1', 'D'),
        scrambleSet('333-r1', 'A'),
      ]).expect(400);

      const leftovers = await db.scrambleSet.deleteMany({
        where: { roundId: '333-r1', set: 'D' },
      });
      expect(leftovers.count).toBe(0);
    });

    it.each([
      ['an empty list of sets', { scrambleSets: [] }],
      [
        'an invalid round id',
        { scrambleSets: [{ ...scrambleSet('333-r1', 'C'), roundId: '333' }] },
      ],
      [
        'a set without scrambles',
        { scrambleSets: [{ ...scrambleSet('333-r1', 'C'), scrambles: [] }] },
      ],
      [
        'a scramble without isExtra',
        {
          scrambleSets: [
            {
              roundId: '333-r1',
              set: 'C',
              scrambles: [{ num: 1, encryptedScramble: 'x' }],
            },
          ],
        },
      ],
    ])('rejects %s', async (_, body) => {
      await asDelegate(request(server()).post('/scramble-set/import'))
        .send(body)
        .expect(400);
      expect(
        await db.scrambleSet.count({ where: { roundId: '333-r1', set: 'C' } }),
      ).toBe(0);
    });

    it('is allowed for admins', async () => {
      await request(server())
        .post('/scramble-set/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ scrambleSets: [scrambleSet('222-r1', 'A')] })
        .expect(201);
    });
  });

  describe('GET /scramble-set/counts', () => {
    it('counts sets per round', async () => {
      const res = await asDelegate(
        request(server()).get('/scramble-set/counts'),
      ).expect(200);

      expect(res.body).toHaveLength(3);
      expect(res.body).toEqual(
        expect.arrayContaining([
          { roundId: '333-r1', count: 2 },
          { roundId: '666-r1', count: 1 },
          { roundId: '222-r1', count: 1 },
        ]),
      );
    });
  });

  describe('GET /scramble-set/:roundId', () => {
    it('returns the sets of a round with scramble counts', async () => {
      const res = await asDelegate(
        request(server()).get('/scramble-set/666-r1'),
      ).expect(200);

      expect(res.body).toEqual([
        {
          id: expect.any(String),
          roundId: '666-r1',
          set: 'A',
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
          scramblesCount: 3,
          extraScramblesCount: 1,
        },
      ]);
    });

    it('returns an empty list for a round without sets', async () => {
      const res = await asDelegate(
        request(server()).get('/scramble-set/minx-r3'),
      ).expect(200);

      expect(res.body).toEqual([]);
    });
  });

  describe('DELETE /scramble-set/:id', () => {
    it('deletes one set together with its scrambles', async () => {
      const set = await db.scrambleSet.findFirst({
        where: { roundId: '333-r1', set: 'B' },
      });

      await asDelegate(
        request(server()).delete(`/scramble-set/${set.id}`),
      ).expect(204);

      expect(
        await db.scrambleSet.findUnique({ where: { id: set.id } }),
      ).toBeNull();
      expect(
        await db.scramble.count({ where: { scrambleSetId: set.id } }),
      ).toBe(0);
      expect(await db.scrambleSet.count({ where: { roundId: '333-r1' } })).toBe(
        1,
      );
    });

    it('returns 404 for an unknown set', async () => {
      await asDelegate(
        request(server()).delete(`/scramble-set/${FAKE_ID}`),
      ).expect(404);
    });
  });

  describe('DELETE /scramble-set/round/:roundId', () => {
    it('deletes only the sets of that round', async () => {
      await asDelegate(
        request(server()).delete('/scramble-set/round/333-r1'),
      ).expect(204);

      expect(await db.scrambleSet.count({ where: { roundId: '333-r1' } })).toBe(
        0,
      );
      expect(await db.scrambleSet.count()).toBe(2);
    });
  });

  describe('DELETE /scramble-set/all', () => {
    it('deletes every set and scramble', async () => {
      await asDelegate(request(server()).delete('/scramble-set/all')).expect(
        204,
      );

      expect(await db.scrambleSet.count()).toBe(0);
      expect(await db.scramble.count()).toBe(0);
    });

    it('lets a previously imported set be imported again', async () => {
      await importSets([scrambleSet('333-r1', 'A')]).expect(201);
      expect(await db.scrambleSet.count({ where: { roundId: '333-r1' } })).toBe(
        1,
      );
    });
  });
});
