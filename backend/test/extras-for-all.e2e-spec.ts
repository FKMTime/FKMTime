import { INestApplication } from '@nestjs/common';
import { AttemptStatus, AttemptType, Person } from '@prisma/client';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';

import { createTestApp } from './helpers/app.helper';
import {
  createRoleUsers,
  createTestPersons,
  deleteTestPersons,
  RoleUsers,
  stubExternalApis,
} from './helpers/competition-day.helper';

const PREFIX = 'e2e-extras-all';
const REGISTRANT_IDS = [9501];
const ROUND_ID = '333-r2';

describe('Extras for all attempts (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let users: RoleUsers;
  let delegate: string;
  let stub: ReturnType<typeof stubExternalApis>;
  let competitor: Person;

  const server = () => app.getHttpServer();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const enterAttempts = async (count: number) => {
    for (let number = 1; number <= count; number++) {
      await request(server())
        .post('/attempt')
        .set(auth(delegate))
        .send({
          attemptNumber: number,
          value: 1000 + number,
          penalty: 0,
          roundId: ROUND_ID,
          competitorId: competitor.id,
          status: AttemptStatus.STANDARD,
          type: AttemptType.STANDARD_ATTEMPT,
        })
        .expect(201);
    }
    return db.result.findFirst({
      where: { personId: competitor.id, roundId: ROUND_ID },
      include: { attempts: { orderBy: { attemptNumber: 'asc' } } },
    });
  };

  const give = (body: Record<string, unknown>) =>
    request(server())
      .post('/attempt/give-extras-for-all')
      .set(auth(delegate))
      .send({ useFreshSet: true, removeFromLive: true, ...body });

  const attemptsOf = (resultId: string) =>
    db.attempt.findMany({
      where: { resultId },
      orderBy: { attemptNumber: 'asc' },
    });

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    users = await createRoleUsers(app, db, PREFIX);
    delegate = users.tokens.DELEGATE;
    stub = stubExternalApis();
    [competitor] = await createTestPersons(db, 'Extras', REGISTRANT_IDS);
  }, 30000);

  afterEach(async () => {
    await db.result.deleteMany({ where: { personId: competitor.id } });
    stub.reset();
  });

  afterAll(async () => {
    try {
      stub.restore();
      await deleteTestPersons(db, { registrantIds: REGISTRANT_IDS });
      await users.cleanup();
    } finally {
      await app.close();
    }
  }, 30000);

  it('replaces the attempts, then puts the originals back', async () => {
    const result = await enterAttempts(3);
    await db.result.update({
      where: { id: result.id },
      data: {
        isDoubleChecked: true,
        doubleCheckedAt: new Date(),
        doubleCheckedById: users.userIds.DELEGATE,
      },
    });

    const given = await give({
      resultId: result.id,
      attemptIds: result.attempts.map((a) => a.id),
      comment: 'E2E illegal cube',
    }).expect(200);
    expect(given.body).toEqual({ replaced: 3 });

    const replaced = await attemptsOf(result.id);
    expect(replaced.every((a) => a.status === AttemptStatus.EXTRA_GIVEN)).toBe(
      true,
    );
    expect(replaced.every((a) => a.replacedBy === null)).toBe(true);
    const checked = await db.result.findUnique({ where: { id: result.id } });
    expect(checked).toMatchObject({
      isDoubleChecked: false,
      doubleCheckedAt: null,
      doubleCheckedById: null,
    });

    const context = await request(server())
      .get(`/attempt/give-extras-for-all/${result.id}`)
      .set(auth(delegate))
      .expect(200);
    expect(context.body.restorableAttemptIds).toHaveLength(3);

    await request(server())
      .post('/attempt/restore-extra-grant')
      .set(auth(delegate))
      .send({ grantId: context.body.restorableGrantId })
      .expect(200);

    const restored = await attemptsOf(result.id);
    expect(restored.every((a) => a.status === AttemptStatus.STANDARD)).toBe(
      true,
    );
    expect(restored.every((a) => a.extraGrantId === null)).toBe(true);
  });

  it('leaves unticked attempts alone', async () => {
    const result = await enterAttempts(2);

    await give({
      resultId: result.id,
      attemptIds: [result.attempts[1].id],
    }).expect(200);

    const attempts = await attemptsOf(result.id);
    expect(attempts.map((a) => a.status)).toEqual([
      AttemptStatus.STANDARD,
      AttemptStatus.EXTRA_GIVEN,
    ]);
  });

  it('refuses a body with no attempts', async () => {
    const result = await enterAttempts(1);

    await give({ resultId: result.id, attemptIds: [] }).expect(400);
  });

  it('requires a delegate', async () => {
    const result = await enterAttempts(1);

    await request(server())
      .post('/attempt/give-extras-for-all')
      .send({
        resultId: result.id,
        attemptIds: [result.attempts[0].id],
        useFreshSet: false,
        removeFromLive: false,
      })
      .expect(401);
  });
});
