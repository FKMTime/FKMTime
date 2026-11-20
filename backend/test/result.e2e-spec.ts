import { INestApplication } from '@nestjs/common';
import { AttemptStatus, AttemptType } from '@prisma/client';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';

import { createTestApp } from './helpers/app.helper';

const ROUND_ID = '333-r2';

describe('ResultController (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let adminToken: string;
  let personId: string;
  let resultId: string;

  beforeAll(async () => {
    ({ app, db, adminToken } = await createTestApp());

    // Use second person to avoid conflicts with attempt tests
    const person = await db.person.findFirst({
      where: { registrantId: 2 },
    });
    personId = person.id;

    // Seed a result with two attempts
    const adminUser = await db.user.findFirst({ where: { username: 'admin' } });
    const result = await db.result.create({
      data: {
        person: { connect: { id: personId } },
        eventId: ROUND_ID.split('-r')[0],
        roundId: ROUND_ID,
        attempts: {
          create: [
            {
              attemptNumber: 1,
              value: 1500,
              penalty: 0,
              status: AttemptStatus.STANDARD,
              type: AttemptType.STANDARD_ATTEMPT,
              solvedAt: new Date(),
              updatedBy: { connect: { id: adminUser.id } },
            },
            {
              attemptNumber: 2,
              value: 1600,
              comment: 'Extra granted: dummy delegate note',
              originalTime: 1590,
              inspectionTime: 9000,
              penalty: 0,
              status: AttemptStatus.STANDARD,
              type: AttemptType.STANDARD_ATTEMPT,
              solvedAt: new Date(),
              updatedBy: { connect: { id: adminUser.id } },
            },
          ],
        },
      },
    });
    resultId = result.id;
  }, 30000);

  afterAll(async () => {
    await db.attemptEditLog.deleteMany({
      where: { attempt: { resultId } },
    });
    await db.attempt.deleteMany({ where: { resultId } });
    await db.result.deleteMany({ where: { id: resultId } });
    await app.close();
  }, 30000);

  describe('GET /result/round/:roundId', () => {
    it('returns results for a round', async () => {
      const res = await request(app.getHttpServer())
        .get(`/result/round/${ROUND_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((r: any) => r.id === resultId)).toBe(true);
    });

    it('filters by search', async () => {
      const person = await db.person.findUnique({ where: { id: personId } });
      const namePart = person.name.split(' ')[0];

      const res = await request(app.getHttpServer())
        .get(`/result/round/${ROUND_ID}?search=${namePart}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .get(`/result/round/${ROUND_ID}`)
        .expect(401);
    });
  });

  describe('GET /result/round/:roundId/person/:personId', () => {
    it('returns or creates result for person in round', async () => {
      const res = await request(app.getHttpServer())
        .get(`/result/round/${ROUND_ID}/person/${personId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('roundId', ROUND_ID);
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .get(`/result/round/${ROUND_ID}/person/${personId}`)
        .expect(401);
    });
  });

  describe('attempt fields outside delegate pages', () => {
    const delegateOnly = [
      'comment',
      'updatedById',
      'originalTime',
      'inspectionTime',
    ];
    const attemptsOf = (body: any[]) =>
      body.find((r) => r.id === resultId).attempts as Record<string, unknown>[];

    it('leaves delegate notes and timer details out of public results', async () => {
      const res = await request(app.getHttpServer())
        .get(`/result/public/round/${ROUND_ID}`)
        .expect(200);
      for (const attempt of attemptsOf(res.body)) {
        for (const field of delegateOnly)
          expect(attempt).not.toHaveProperty(field);
      }
    });

    it('leaves them out of round and person results too', async () => {
      for (const path of [
        `/result/round/${ROUND_ID}`,
        `/result/person/${personId}`,
      ]) {
        const res = await request(app.getHttpServer())
          .get(path)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
        for (const attempt of attemptsOf(res.body)) {
          for (const field of delegateOnly)
            expect(attempt).not.toHaveProperty(field);
        }
      }
    });

    it('keeps them on the single result delegates open', async () => {
      const res = await request(app.getHttpServer())
        .get(`/result/${resultId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(
        res.body.attempts.find((a: any) => a.attemptNumber === 2),
      ).toMatchObject({
        comment: 'Extra granted: dummy delegate note',
        inspectionTime: 9000,
      });
    });
  });

  describe('GET /result/person/:id', () => {
    it('returns all results for a person', async () => {
      const res = await request(app.getHttpServer())
        .get(`/result/person/${personId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((r: any) => r.id === resultId)).toBe(true);
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .get(`/result/person/${personId}`)
        .expect(401);
    });
  });

  describe('GET /result/:id', () => {
    it('returns result by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/result/${resultId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('id', resultId);
      expect(res.body).toHaveProperty('attempts');
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer()).get(`/result/${resultId}`).expect(401);
    });
  });

  describe('GET /result/round/:roundId/double-check', () => {
    it('returns results to double check', async () => {
      const res = await request(app.getHttpServer())
        .get(`/result/round/${ROUND_ID}/double-check`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('results');
      expect(Array.isArray(res.body.results)).toBe(true);
      expect(res.body).toHaveProperty('totalCount');
    });
  });

  describe('GET /result/round/:roundId/missing-persons', () => {
    it('returns persons with no results', async () => {
      const res = await request(app.getHttpServer())
        .get(`/result/round/${ROUND_ID}/missing-persons`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /result/checks', () => {
    it('returns result checks for a round', async () => {
      const res = await request(app.getHttpServer())
        .get(`/result/checks?roundId=${ROUND_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toBeDefined();
    });
  });

  describe('POST /result/:id/assign-dns', () => {
    it('assigns DNS to remaining attempts', async () => {
      await request(app.getHttpServer())
        .post(`/result/${resultId}/assign-dns`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('DELETE /result/:id', () => {
    it('deletes a result', async () => {
      // Create a separate result to delete
      const person3 = await db.person.findFirst({ where: { registrantId: 3 } });
      const tempResult = await db.result.create({
        data: {
          person: { connect: { id: person3.id } },
          eventId: ROUND_ID.split('-r')[0],
          roundId: ROUND_ID,
        },
      });

      await request(app.getHttpServer())
        .delete(`/result/${tempResult.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      const gone = await db.result.findUnique({ where: { id: tempResult.id } });
      expect(gone).toBeNull();
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .delete(`/result/${resultId}`)
        .expect(401);
    });
  });
});
