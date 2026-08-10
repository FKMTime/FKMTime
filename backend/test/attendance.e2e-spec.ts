import { INestApplication } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';

import { createTestApp } from './helpers/app.helper';

describe('AttendanceController (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let adminToken: string;
  let staffActivityId: string;
  let personId: string;
  let groupId: string;

  beforeAll(async () => {
    ({ app, db, adminToken } = await createTestApp());

    // Get a staff activity from seed data
    const activity = await db.staffActivity.findFirst({
      include: { person: true },
    });
    staffActivityId = activity.id;
    personId = activity.personId;
    groupId = activity.groupId;
  }, 30000);

  afterAll(async () => {
    await app.close();
  }, 30000);

  describe('GET /attendance/group/:groupId', () => {
    it('returns attendance for a group', async () => {
      const res = await request(app.getHttpServer())
        .get(`/attendance/group/${encodeURIComponent(groupId)}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .get(`/attendance/group/${encodeURIComponent(groupId)}`)
        .expect(401);
    });
  });

  describe('GET /attendance/statistics', () => {
    it('returns attendance statistics', async () => {
      const res = await request(app.getHttpServer())
        .get('/attendance/statistics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toBeDefined();
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .get('/attendance/statistics')
        .expect(401);
    });
  });

  describe('GET /attendance/missed', () => {
    it('returns most missed assignments', async () => {
      const res = await request(app.getHttpServer())
        .get('/attendance/missed')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer()).get('/attendance/missed').expect(401);
    });
  });

  describe('GET /attendance/person/:id', () => {
    it('returns staff activities for a person', async () => {
      const res = await request(app.getHttpServer())
        .get(`/attendance/person/${personId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .get(`/attendance/person/${personId}`)
        .expect(401);
    });
  });

  describe('POST /attendance/present/:id', () => {
    it('marks a staff activity as present', async () => {
      const res = await request(app.getHttpServer())
        .post(`/attendance/present/${staffActivityId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(res.body).toBeDefined();
    });
  });

  describe('POST /attendance/absent/:id', () => {
    it('marks a staff activity as absent', async () => {
      const res = await request(app.getHttpServer())
        .post(`/attendance/absent/${staffActivityId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(res.body).toBeDefined();
    });
  });

  describe('POST /attendance/late/:id', () => {
    it('marks a staff activity as late', async () => {
      const res = await request(app.getHttpServer())
        .post(`/attendance/late/${staffActivityId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(res.body).toBeDefined();
    });
  });

  describe('POST /attendance/present-replaced/:id', () => {
    it('marks a staff activity as present but replaced', async () => {
      const res = await request(app.getHttpServer())
        .post(`/attendance/present-replaced/${staffActivityId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(res.body).toBeDefined();
    });
  });

  describe('PUT /attendance/comment/:id', () => {
    it('updates comment on a staff activity', async () => {
      const res = await request(app.getHttpServer())
        .put(`/attendance/comment/${staffActivityId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ comment: 'e2e test comment' })
        .expect(200);

      expect(res.body).toBeDefined();

      // Clean up
      await request(app.getHttpServer())
        .put(`/attendance/comment/${staffActivityId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ comment: null });
    });
  });

  describe('POST /attendance/unassigned/:groupId', () => {
    it('adds an unassigned person to a group', async () => {
      const res = await request(app.getHttpServer())
        .post(`/attendance/unassigned/${encodeURIComponent(groupId)}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ personId, role: 'STAFF_OTHER' })
        .expect(201);

      expect(res.body).toBeDefined();
    });
  });
});
