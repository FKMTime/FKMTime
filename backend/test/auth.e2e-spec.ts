import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { sha512 } from 'js-sha512';
import { AppModule } from 'src/app.module';
import * as request from 'supertest';

import { loginWithFKMAccount } from './helpers/auth.helper';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prismaClient: PrismaClient;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, PrismaClient],
    }).compile();

    app = moduleFixture.createNestApplication();
    //Uncomment this if there is a need to debug
    //app.useLogger(new Logger());
    await app.init();
    prismaClient = moduleFixture.get<PrismaClient>(PrismaClient);
  }, 30000);

  afterAll(async () => {
    await app.close();
    await prismaClient.$disconnect();
  }, 30000);

  describe('FKMTime Auth', () => {
    it('should login a user', async () => {
      const user = {
        username: 'admin',
        password: 'admin',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(user)
        .expect(200);

      expect(response.body).toEqual({
        token: expect.any(String),
        userInfo: {
          id: expect.any(String),
          username: user.username,
          role: 'ADMIN',
          fullName: 'Admin',
        },
      });
    });

    it('should return 403 when wrong credentials', async () => {
      const user = {
        username: 'admin',
        password: 'wrong',
      };

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(user)
        .expect(403);
    });

    it('should get user info', async () => {
      const user = await loginWithFKMAccount(app, {
        username: 'admin',
        password: 'admin',
      });

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      expect(response.body).toEqual({
        id: expect.any(String),
        username: user.userInfo.username,
        fullName: user.userInfo.fullName,
        role: user.userInfo.role,
        isWcaAdmin: false,
        avatarUrl: null,
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

      const newPassword = 'newPassword';
      await request(app.getHttpServer())
        .put('/auth/password/change')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ oldPassword: 'admin', newPassword: newPassword })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: user.userInfo.username, password: newPassword })
        .expect(200);

      await prismaClient.user.update({
        where: { id: user.userInfo.id },
        data: { password: sha512('admin') },
      });
    });

    it('should return 403 when wrong old password', async () => {
      const user = await loginWithFKMAccount(app, {
        username: 'admin',
        password: 'admin',
      });

      await request(app.getHttpServer())
        .put('/auth/password/change')
        .set('Authorization', `Bearer ${user.token}`)
        .send({ oldPassword: 'wrong', newPassword: 'newPassword' })
        .expect(403);
    });
  });

  describe('WCA Auth', () => {
    it('should login with WCA', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/wca/login')
        .send({
          code: 'code-2022GALA01',
          redirectUri: 'http://localhost:5173/auth/login',
        })
        .expect(200);

      expect(response.body).toEqual({
        token: expect.any(String),
        userInfo: {
          id: expect.any(String),
          fullName: expect.any(String),
          role: expect.any(String),
          username: null,
          wcaAccessToken: expect.any(String),
          isWcaAdmin: false,
        },
      });
    });
  });
});
