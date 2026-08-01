import { INestApplication } from '@nestjs/common';
import { AppModule } from 'src/app.module';
import * as request from 'supertest';

import { createTestApp } from './helpers/app.helper';
import { DbService } from 'src/db/db.service';

describe('SettingsController (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let adminToken: string;

  beforeAll(async () => {
    ({ app, db, adminToken } = await createTestApp());
  }, 30000);

  afterAll(async () => {
    await db.quickAction.deleteMany({ where: { name: 'Test' } });
    await app.close();
  }, 30000);

  it('returns settings', async () => {
    await request(app.getHttpServer())
      .get('/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('creates a quick action', async () => {
    await request(app.getHttpServer())
      .post('/settings/quick-actions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test',
        comment: 'Test',
        giveExtra: true,
      })
      .expect(201);
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
});
