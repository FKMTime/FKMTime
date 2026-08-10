import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import { createTestApp } from './helpers/app.helper';
import { loginWithFKMAccount } from './helpers/auth.helper';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    ({ app, adminToken } = await createTestApp());
  }, 30000);

  afterAll(async () => {
    await app.close();
  }, 30000);

  describe('FKMTime Auth', () => {
    it('should login a user', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'admin', password: 'admin' })
        .expect(200);

      expect(response.body).toEqual({
        token: expect.any(String),
        userInfo: {
          id: expect.any(String),
          username: 'admin',
          roles: ['ADMIN'],
          fullName: 'Admin',
        },
      });
    });

    it('should return 403 when wrong credentials', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'admin', password: 'wrong' })
        .expect(403);
    });

    it('should get user info', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual({
        id: expect.any(String),
        username: 'admin',
        fullName: 'Admin',
        roles: ['ADMIN'],
        avatarUrl: null,
        wcaAccessToken: null,
      });
    });

    it('should return 401 when no token', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('should change password', async () => {
      const user = await loginWithFKMAccount(app, {
        username: 'admin',
        password: 'admin',
      });

      await request(app.getHttpServer())
        .put('/auth/password/change')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ oldPassword: 'admin', newPassword: 'newPassword' })
        .expect(200);

      const newLogin = await loginWithFKMAccount(app, {
        username: 'admin',
        password: 'newPassword',
      });

      // Restore via API so password stays properly bcrypt-hashed
      await request(app.getHttpServer())
        .put('/auth/password/change')
        .set('Authorization', `Bearer ${newLogin.token}`)
        .send({ oldPassword: 'newPassword', newPassword: 'admin' })
        .expect(200);
    });

    it('should return 403 when wrong old password', async () => {
      await request(app.getHttpServer())
        .put('/auth/password/change')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ oldPassword: 'wrong', newPassword: 'newPassword' })
        .expect(403);
    });
  });

  describe('WCA Auth', () => {
    it.skip('should login with WCA (requires mock WCA server at localhost:3000)', async () => {
      await request(app.getHttpServer())
        .post('/auth/wca/login')
        .send({
          code: 'code-2022GALA01',
          redirectUri: 'http://localhost:5173/auth/login',
        })
        .expect(200);
    });
  });
});
