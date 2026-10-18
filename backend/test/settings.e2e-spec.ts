import { INestApplication } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';

import { createTestApp } from './helpers/app.helper';

describe('SettingsController (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let adminToken: string;
  let quickActionId: string;

  beforeAll(async () => {
    ({ app, db, adminToken } = await createTestApp());
  }, 30000);

  afterAll(async () => {
    await db.quickAction.deleteMany({
      where: { name: { startsWith: 'Test' } },
    });
    await app.close();
  }, 30000);

  it('returns settings', async () => {
    await request(app.getHttpServer())
      .get('/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('creates a quick action', async () => {
    const response = await request(app.getHttpServer())
      .post('/settings/quick-actions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test',
        comment: 'Test',
        giveExtra: true,
        isShared: true,
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: 'Test',
        comment: 'Test',
        giveExtra: true,
        isShared: true,
      }),
    );
    quickActionId = response.body.id;
  });

  it('get quick actions', async () => {
    const response = await request(app.getHttpServer())
      .get('/settings/quick-actions')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          isShared: true,
          user: {
            id: expect.any(String),
            fullName: 'Admin',
          },
          userId: expect.any(String),
          name: 'Test',
          comment: 'Test',
          giveExtra: true,
        }),
      ]),
    );
  });

  it('updates a quick action', async () => {
    const response = await request(app.getHttpServer())
      .put(`/settings/quick-actions/${quickActionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test updated',
        comment: 'Updated comment',
        giveExtra: false,
        isShared: false,
      })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: quickActionId,
        name: 'Test updated',
        comment: 'Updated comment',
        giveExtra: false,
        isShared: false,
      }),
    );
  });

  it('deletes a quick action', async () => {
    await request(app.getHttpServer())
      .delete(`/settings/quick-actions/${quickActionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
  });

  it('returns 401 when not authenticated', async () => {
    await request(app.getHttpServer()).get('/settings').expect(401);
    await request(app.getHttpServer())
      .get('/settings/quick-actions')
      .expect(401);
  });
});
