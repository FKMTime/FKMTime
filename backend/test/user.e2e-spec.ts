import { INestApplication } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';

import { createTestApp } from './helpers/app.helper';

describe('UserController (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let adminToken: string;
  let userId = '';

  beforeAll(async () => {
    ({ app, db, adminToken } = await createTestApp());
  }, 30000);

  afterAll(async () => {
    await db.user.deleteMany({
      where: { username: { in: ['newuser', 'wcauser'] } },
    });
    await app.close();
  }, 30000);

  it('returns all users', async () => {
    const response = await request(app.getHttpServer())
      .get('/user')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          username: 'admin',
          fullName: 'Admin',
          roles: expect.arrayContaining(['ADMIN']),
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
          wcaUserId: null,
          avatarUrl: null,
        }),
      ]),
    );
  });

  it('creates FKMTime user', async () => {
    await request(app.getHttpServer())
      .post('/user')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'newuser',
        fullName: 'New User',
        password: 'newpassword',
        roles: ['ADMIN'],
      })
      .expect(201);

    const userFromDb = await db.user.findFirst({
      where: { username: 'newuser' },
    });

    userId = userFromDb.id;
  });

  it('creates WCA user', async () => {
    await request(app.getHttpServer())
      .post('/user')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'wcauser',
        fullName: 'WCA User',
        password: 'wcapassword',
        roles: ['ADMIN'],
      })
      .expect(201);
  });

  it('updates a user', async () => {
    await request(app.getHttpServer())
      .put(`/user/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'newuser',
        fullName: 'Updated User',
        roles: ['ADMIN'],
      })
      .expect(200);
  });

  it('updates a user password', async () => {
    await request(app.getHttpServer())
      .put(`/user/password/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        password: 'newpassword',
      })
      .expect(200);
  });

  it('deletes a user', async () => {
    await request(app.getHttpServer())
      .delete(`/user/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
  });
});
