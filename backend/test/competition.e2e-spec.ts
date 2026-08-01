import { INestApplication } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';

import { createTestApp } from './helpers/app.helper';

describe('CompetitionController (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let adminToken: string;
  let competitionId: string;

  beforeAll(async () => {
    ({ app, db, adminToken } = await createTestApp());
    const competition = await db.competition.findFirst();
    competitionId = competition.id;
  }, 30000);

  afterAll(async () => {
    await app.close();
  }, 30000);

  describe('GET /competition/login-info', () => {
    it('returns login info without auth', async () => {
      const res = await request(app.getHttpServer())
        .get('/competition/login-info')
        .expect(200);

      expect(res.body).toHaveProperty('name');
    });
  });

  describe('GET /competition', () => {
    it('returns competition info when authenticated', async () => {
      const res = await request(app.getHttpServer())
        .get('/competition')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('name');
      expect(res.body).toHaveProperty('wcaId');
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer()).get('/competition').expect(401);
    });
  });

  describe('GET /competition/statistics', () => {
    it('returns statistics when authenticated', async () => {
      const res = await request(app.getHttpServer())
        .get('/competition/statistics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toBeDefined();
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .get('/competition/statistics')
        .expect(401);
    });
  });

  describe('GET /competition/rounds', () => {
    it('returns rounds when authenticated', async () => {
      const res = await request(app.getHttpServer())
        .get('/competition/rounds')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer()).get('/competition/rounds').expect(401);
    });
  });

  describe('GET /competition/rooms', () => {
    it('returns rooms when authenticated', async () => {
      const res = await request(app.getHttpServer())
        .get('/competition/rooms')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer()).get('/competition/rooms').expect(401);
    });
  });

  describe('GET /competition/settings', () => {
    it('returns settings for organizer', async () => {
      await request(app.getHttpServer())
        .get('/competition/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .get('/competition/settings')
        .expect(401);
    });
  });

  describe('GET /competition/available-locales', () => {
    it('returns available locales for organizer', async () => {
      const res = await request(app.getHttpServer())
        .get('/competition/available-locales')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('PUT /competition/settings/:id', () => {
    it('updates competition settings', async () => {
      const competition = await db.competition.findFirst();
      await request(app.getHttpServer())
        .put(`/competition/settings/${competition.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          scoretakingToken: 'new-token',
          sendingResultsFrequency: 'AFTER_SOLVE',
          shouldChangeGroupsAutomatically: false,
          useFkmTimeDevices: true,
        })
        .expect(200);

      // Restore original token
      await db.competition.update({
        where: { id: competition.id },
        data: { scoretakingToken: competition.scoretakingToken },
      });
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .put(`/competition/settings/${competitionId}`)
        .send({
          scoretakingToken: 'token',
          sendingResultsFrequency: 'AFTER_SOLVE',
          shouldChangeGroupsAutomatically: false,
          useFkmTimeDevices: true,
        })
        .expect(401);
    });
  });

  describe('PUT /competition/rooms', () => {
    it('updates current rounds for rooms', async () => {
      const rooms = await db.room.findMany();
      await request(app.getHttpServer())
        .put('/competition/rooms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          rooms: rooms.map((r) => ({
            id: r.id,
            currentGroupIds: ['333-r1-g1'],
          })),
        })
        .expect(200);

      // Clean up
      for (const room of rooms) {
        await db.room.update({
          where: { id: room.id },
          data: { currentGroupIds: [] },
        });
      }
    });
  });
});
