import { INestApplication } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';

import { createTestApp } from './helpers/app.helper';

const ROUND_ID = '333-r1';

describe('IncidentController (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let adminToken: string;
  let personId: string;
  let noteworthyId: string;
  let warningId: string;
  let manualIncidentId: string;

  beforeAll(async () => {
    ({ app, db, adminToken } = await createTestApp());
    const person = await db.person.findFirst({ where: { registrantId: 5 } });
    personId = person.id;
  }, 30000);

  afterAll(async () => {
    await db.noteworthyIncident.deleteMany({
      where: { title: { startsWith: 'e2e-' } },
    });
    await db.warning.deleteMany({
      where: { description: { startsWith: 'e2e-' } },
    });
    await db.manualIncident.deleteMany({
      where: { description: { startsWith: 'e2e-' } },
    });
    await app.close();
  }, 30000);

  describe('GET /incident/unresolved', () => {
    it('returns unresolved incidents', async () => {
      const res = await request(app.getHttpServer())
        .get('/incident/unresolved')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('filters by roundId', async () => {
      const res = await request(app.getHttpServer())
        .get(`/incident/unresolved?roundId=${ROUND_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .get('/incident/unresolved')
        .expect(401);
    });
  });

  describe('GET /incident/unresolved/count', () => {
    it('returns count of unresolved incidents', async () => {
      const res = await request(app.getHttpServer())
        .get('/incident/unresolved/count')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('count');
      expect(typeof res.body.count).toBe('number');
    });
  });

  describe('GET /incident/round/:roundId', () => {
    it('returns incidents for a round', async () => {
      const res = await request(app.getHttpServer())
        .get(`/incident/round/${ROUND_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /incident/resolved', () => {
    it('returns resolved incidents', async () => {
      const res = await request(app.getHttpServer())
        .get('/incident/resolved')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Noteworthy incidents', () => {
    it('POST /incident/noteworthy creates a noteworthy incident', async () => {
      const res = await request(app.getHttpServer())
        .post('/incident/noteworthy')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'e2e-noteworthy',
          description: 'Test noteworthy incident',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('title', 'e2e-noteworthy');
      noteworthyId = res.body.id;
    });

    it('GET /incident/noteworthy returns noteworthy incidents', async () => {
      const res = await request(app.getHttpServer())
        .get('/incident/noteworthy')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((i: any) => i.id === noteworthyId)).toBe(true);
    });

    it('PUT /incident/noteworthy/:id updates a noteworthy incident', async () => {
      const res = await request(app.getHttpServer())
        .put(`/incident/noteworthy/${noteworthyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'e2e-noteworthy-updated', description: 'Updated' })
        .expect(200);

      expect(res.body).toHaveProperty('title', 'e2e-noteworthy-updated');
    });

    it('DELETE /incident/noteworthy/:id deletes a noteworthy incident', async () => {
      await request(app.getHttpServer())
        .delete(`/incident/noteworthy/${noteworthyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      const gone = await db.noteworthyIncident.findUnique({
        where: { id: noteworthyId },
      });
      expect(gone).toBeNull();
      noteworthyId = null;
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .get('/incident/noteworthy')
        .expect(401);
    });
  });

  describe('Warnings', () => {
    it('POST /incident/warnings/person/:id issues a warning', async () => {
      const res = await request(app.getHttpServer())
        .post(`/incident/warnings/person/${personId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'e2e-warning: misconduct' })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      warningId = res.body.id;
    });

    it('GET /incident/warnings returns all warnings', async () => {
      const res = await request(app.getHttpServer())
        .get('/incident/warnings')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((w: any) => w.id === warningId)).toBe(true);
    });

    it('GET /incident/warnings/person/:id returns warnings for a person', async () => {
      const res = await request(app.getHttpServer())
        .get(`/incident/warnings/person/${personId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((w: any) => w.id === warningId)).toBe(true);
    });

    it('DELETE /incident/warnings/:id deletes a warning', async () => {
      await request(app.getHttpServer())
        .delete(`/incident/warnings/${warningId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      const gone = await db.warning.findUnique({ where: { id: warningId } });
      expect(gone).toBeNull();
      warningId = null;
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer()).get('/incident/warnings').expect(401);
    });
  });

  describe('Manual incidents', () => {
    it('POST /incident/manual creates a manual incident', async () => {
      const res = await request(app.getHttpServer())
        .post('/incident/manual')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          personId,
          roundId: ROUND_ID,
          description: 'e2e-manual: misscramble',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      manualIncidentId = res.body.id;
    });

    it('GET /incident/manual returns manual incidents', async () => {
      const res = await request(app.getHttpServer())
        .get('/incident/manual')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((i: any) => i.id === manualIncidentId)).toBe(true);
    });

    it('PUT /incident/manual/:id updates a manual incident', async () => {
      const res = await request(app.getHttpServer())
        .put(`/incident/manual/${manualIncidentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          personId,
          roundId: ROUND_ID,
          description: 'e2e-manual: updated',
        })
        .expect(200);

      expect(res.body).toHaveProperty('description', 'e2e-manual: updated');
    });

    it('DELETE /incident/manual/:id deletes a manual incident', async () => {
      await request(app.getHttpServer())
        .delete(`/incident/manual/${manualIncidentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      const gone = await db.manualIncident.findUnique({
        where: { id: manualIncidentId },
      });
      expect(gone).toBeNull();
      manualIncidentId = null;
    });

    it('returns 400 when personId is not a UUID', async () => {
      await request(app.getHttpServer())
        .post('/incident/manual')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          personId: 'not-a-uuid',
          roundId: ROUND_ID,
          description: 'e2e-invalid',
        })
        .expect(400);
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer()).get('/incident/manual').expect(401);
    });
  });
});
