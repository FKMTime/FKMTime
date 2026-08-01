import { INestApplication } from '@nestjs/common';
import { AttemptStatus, AttemptType } from '@prisma/client';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';

import { createTestApp } from './helpers/app.helper';

const ROUND_ID = '333-r1';

describe('AttemptController (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let adminToken: string;
  let competitorId: string;
  let attemptId: string;
  let secondAttemptId: string;
  let resultId: string;

  beforeAll(async () => {
    ({ app, db, adminToken } = await createTestApp());
    const person = await db.person.findFirst({
      orderBy: { registrantId: 'asc' },
    });
    competitorId = person.id;
  }, 30000);

  afterAll(async () => {
    // Clean up attempts → results created during tests
    if (resultId) {
      await db.attempt.deleteMany({ where: { resultId } });
      await db.result.deleteMany({ where: { id: resultId } });
    }
    await db.attemptEditLog.deleteMany({
      where: {
        attempt: { result: { personId: competitorId, roundId: ROUND_ID } },
      },
    });
    await db.attempt.deleteMany({
      where: { result: { personId: competitorId, roundId: ROUND_ID } },
    });
    await db.result.deleteMany({
      where: { personId: competitorId, roundId: ROUND_ID },
    });
    await app.close();
  }, 30000);

  describe('POST /attempt', () => {
    it('creates an attempt', async () => {
      const res = await request(app.getHttpServer())
        .post('/attempt')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          attemptNumber: 1,
          value: 1000,
          penalty: 0,
          roundId: ROUND_ID,
          competitorId,
          status: AttemptStatus.STANDARD,
          type: AttemptType.STANDARD_ATTEMPT,
        })
        .expect(201);

      expect(res.body).toEqual({ message: 'Attempt created successfully' });

      const result = await db.result.findFirst({
        where: { personId: competitorId, roundId: ROUND_ID },
        include: { attempts: true },
      });
      expect(result).toBeTruthy();
      resultId = result.id;
      attemptId = result.attempts[0].id;
    });

    it('creates a second attempt', async () => {
      await request(app.getHttpServer())
        .post('/attempt')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          attemptNumber: 2,
          value: 1200,
          penalty: 0,
          roundId: ROUND_ID,
          competitorId,
          status: AttemptStatus.STANDARD,
          type: AttemptType.STANDARD_ATTEMPT,
        })
        .expect(201);

      const result = await db.result.findFirst({
        where: { personId: competitorId, roundId: ROUND_ID },
        include: { attempts: { orderBy: { attemptNumber: 'asc' } } },
      });
      secondAttemptId = result.attempts[1].id;
    });

    it('returns 409 for duplicate attempt number + type', async () => {
      await request(app.getHttpServer())
        .post('/attempt')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          attemptNumber: 1,
          value: 999,
          penalty: 0,
          roundId: ROUND_ID,
          competitorId,
          status: AttemptStatus.STANDARD,
          type: AttemptType.STANDARD_ATTEMPT,
        })
        .expect(409);
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .post('/attempt')
        .send({
          attemptNumber: 3,
          value: 1000,
          penalty: 0,
          roundId: ROUND_ID,
          competitorId,
          status: AttemptStatus.STANDARD,
          type: AttemptType.STANDARD_ATTEMPT,
        })
        .expect(401);
    });
  });

  describe('GET /attempt/:id', () => {
    it('returns attempt by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/attempt/${attemptId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.attempt).toMatchObject({
        id: attemptId,
        value: 1000,
        attemptNumber: 1,
      });
      expect(res.body).toHaveProperty('previousIncidents');
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .get(`/attempt/${attemptId}`)
        .expect(401);
    });
  });

  describe('GET /attempt/:id/edit-log', () => {
    it('returns edit log for attempt', async () => {
      const res = await request(app.getHttpServer())
        .get(`/attempt/${attemptId}/edit-log`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('comment');
      expect(res.body[0]).toHaveProperty('editedAt');
    });
  });

  describe('GET /attempt/round/:roundId/recent', () => {
    it('returns recent attempts for a round', async () => {
      const res = await request(app.getHttpServer())
        .get(`/attempt/round/${ROUND_ID}/recent`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('PUT /attempt/:id', () => {
    it('updates an attempt', async () => {
      await request(app.getHttpServer())
        .put(`/attempt/${attemptId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          attemptNumber: 1,
          value: 1100,
          penalty: 200,
          status: AttemptStatus.STANDARD,
          type: AttemptType.STANDARD_ATTEMPT,
        })
        .expect(200);

      const updated = await db.attempt.findUnique({ where: { id: attemptId } });
      expect(updated.value).toBe(1100);
      expect(updated.penalty).toBe(200);
    });

    it('returns 400 when judge equals competitor', async () => {
      await request(app.getHttpServer())
        .put(`/attempt/${attemptId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          attemptNumber: 1,
          value: 1100,
          penalty: 0,
          status: AttemptStatus.STANDARD,
          type: AttemptType.STANDARD_ATTEMPT,
          judgeId: competitorId,
        })
        .expect(400);
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .put(`/attempt/${attemptId}`)
        .send({
          attemptNumber: 1,
          value: 999,
          penalty: 0,
          status: AttemptStatus.STANDARD,
          type: AttemptType.STANDARD_ATTEMPT,
        })
        .expect(401);
    });
  });

  describe('PUT /attempt/swap', () => {
    it('swaps two attempts', async () => {
      await request(app.getHttpServer())
        .put('/attempt/swap')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstAttemptId: attemptId,
          secondAttemptId,
        })
        .expect(200);

      const first = await db.attempt.findUnique({ where: { id: attemptId } });
      const second = await db.attempt.findUnique({
        where: { id: secondAttemptId },
      });
      expect(first.attemptNumber).toBe(2);
      expect(second.attemptNumber).toBe(1);

      // Swap back
      await db.attempt.update({
        where: { id: attemptId },
        data: { attemptNumber: 1 },
      });
      await db.attempt.update({
        where: { id: secondAttemptId },
        data: { attemptNumber: 2 },
      });
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .put('/attempt/swap')
        .send({ firstAttemptId: attemptId, secondAttemptId })
        .expect(401);
    });
  });

  describe('PUT /attempt/reorder', () => {
    it('reorders attempts', async () => {
      await request(app.getHttpServer())
        .put('/attempt/reorder')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          attemptIds: [secondAttemptId, attemptId],
          resultId,
        })
        .expect(200);

      const first = await db.attempt.findUnique({
        where: { id: secondAttemptId },
      });
      const second = await db.attempt.findUnique({ where: { id: attemptId } });
      expect(first.attemptNumber).toBe(1);
      expect(second.attemptNumber).toBe(2);

      // Restore order
      await db.attempt.update({
        where: { id: attemptId },
        data: { attemptNumber: 1 },
      });
      await db.attempt.update({
        where: { id: secondAttemptId },
        data: { attemptNumber: 2 },
      });
    });
  });

  describe('PUT /attempt/:id/replacement', () => {
    it('sets replacement extra number on attempt', async () => {
      // First mark attempt as EXTRA_GIVEN so it can have a replacement
      await db.attempt.update({
        where: { id: attemptId },
        data: { status: AttemptStatus.EXTRA_GIVEN },
      });

      await request(app.getHttpServer())
        .put(`/attempt/${attemptId}/replacement`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ replacedByExtraNumber: 1 })
        .expect(200);

      const updated = await db.attempt.findUnique({ where: { id: attemptId } });
      expect(updated.replacedBy).toBe(1);
    });

    it('clears replacement', async () => {
      await request(app.getHttpServer())
        .put(`/attempt/${attemptId}/replacement`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ replacedByExtraNumber: null })
        .expect(200);

      const updated = await db.attempt.findUnique({ where: { id: attemptId } });
      expect(updated.replacedBy).toBeNull();

      // Restore status
      await db.attempt.update({
        where: { id: attemptId },
        data: { status: AttemptStatus.STANDARD },
      });
    });
  });

  describe('POST /attempt/scorecard', () => {
    it('enters a scorecard with new and updated attempts', async () => {
      const res = await request(app.getHttpServer())
        .post('/attempt/scorecard')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          resultId,
          attempts: [
            {
              id: attemptId,
              attemptNumber: 1,
              value: 950,
              penalty: 0,
              status: AttemptStatus.STANDARD,
              type: AttemptType.STANDARD_ATTEMPT,
            },
          ],
          newAttempts: [
            {
              attemptNumber: 3,
              value: 1050,
              penalty: 0,
              roundId: ROUND_ID,
              competitorId,
              status: AttemptStatus.STANDARD,
              type: AttemptType.STANDARD_ATTEMPT,
            },
          ],
        })
        .expect(200);

      expect(res.body).toEqual({ message: 'Scorecard entered successfully' });

      const attempt1 = await db.attempt.findUnique({
        where: { id: attemptId },
      });
      expect(attempt1.value).toBe(950);
    });
  });

  describe('DELETE /attempt/:id', () => {
    it('deletes an attempt', async () => {
      const attempt3 = await db.attempt.findFirst({
        where: { resultId, attemptNumber: 3 },
      });
      if (!attempt3) return;

      const res = await request(app.getHttpServer())
        .delete(`/attempt/${attempt3.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('resultDeleted');
    });

    it('deletes result when last attempt is deleted', async () => {
      // Delete remaining attempts one by one until result is gone
      const attempts = await db.attempt.findMany({ where: { resultId } });
      let lastBody: any;
      for (const a of attempts) {
        const res = await request(app.getHttpServer())
          .delete(`/attempt/${a.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
        lastBody = res.body;
      }
      expect(lastBody.resultDeleted).toBe(true);
      resultId = null;
    });

    it('returns 404 for non-existent attempt', async () => {
      await request(app.getHttpServer())
        .delete('/attempt/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .delete(`/attempt/${attemptId}`)
        .expect(401);
    });
  });
});
