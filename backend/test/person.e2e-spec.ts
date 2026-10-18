import { INestApplication } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';

import { createTestApp } from './helpers/app.helper';

describe('PersonController (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let adminToken: string;
  let personId: string;

  beforeAll(async () => {
    ({ app, db, adminToken } = await createTestApp());
    const person = await db.person.findFirst({
      orderBy: { registrantId: 'asc' },
    });
    personId = person.id;
  }, 30000);

  afterAll(async () => {
    await app.close();
  }, 30000);

  describe('GET /person', () => {
    it('returns paginated person list', async () => {
      const res = await request(app.getHttpServer())
        .get('/person?page=1&pageSize=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('count');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer()).get('/person').expect(401);
    });
  });

  describe('GET /person/all', () => {
    it('returns all persons', async () => {
      const res = await request(app.getHttpServer())
        .get('/person/all')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('filters by search', async () => {
      const res = await request(app.getHttpServer())
        .get('/person/all?search=Gala')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      res.body.forEach((p: any) =>
        expect(p.name.toLowerCase()).toContain('gala'),
      );
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer()).get('/person/all').expect(401);
    });
  });

  describe('GET /person/without-card', () => {
    it('returns persons without card count', async () => {
      const res = await request(app.getHttpServer())
        .get('/person/without-card')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('count');
      expect(typeof res.body.count).toBe('number');
    });
  });

  describe('GET /person/check-in', () => {
    it('returns checked-in count', async () => {
      const res = await request(app.getHttpServer())
        .get('/person/check-in')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('checkedInPersonsCount');
      expect(res.body).toHaveProperty('totalPersonsCount');
    });
  });

  describe('GET /person/:id', () => {
    it('returns person by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/person/${personId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('id', personId);
      expect(res.body).toHaveProperty('name');
      expect(res.body).toHaveProperty('registrantId');
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer()).get(`/person/${personId}`).expect(401);
    });
  });

  describe('PUT /person/:id', () => {
    it('updates a person', async () => {
      const person = await db.person.findUnique({ where: { id: personId } });

      const res = await request(app.getHttpServer())
        .put(`/person/${personId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          cardId: 'E2E-TEST-CARD-001',
        })
        .expect(200);

      expect(res.body).toHaveProperty('message');

      // Restore original cardId
      await db.person.update({
        where: { id: personId },
        data: { cardId: person.cardId },
      });
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .put(`/person/${personId}`)
        .send({ cardId: 'UNAUTH' })
        .expect(401);
    });
  });

  describe('POST /person/check-in/:id', () => {
    it('checks in a person', async () => {
      await request(app.getHttpServer())
        .post(`/person/check-in/${personId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(200);

      const updated = await db.person.findUnique({ where: { id: personId } });
      expect(updated.checkedInAt).not.toBeNull();

      // Restore
      await db.person.update({
        where: { id: personId },
        data: { checkedInAt: null },
      });
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .post(`/person/check-in/${personId}`)
        .expect(401);
    });
  });
});
