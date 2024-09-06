import { INestApplication } from '@nestjs/common';
import { TestingModule, Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { AppModule } from 'src/app.module';
import * as request from 'supertest';
import { loginWithFKMAccount } from './helpers/auth.helper';

describe('UserController (e2e)', () => {
  let app: INestApplication;
  let prismaClient: PrismaClient;
  let userId = '';

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, PrismaClient],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prismaClient = moduleFixture.get<PrismaClient>(PrismaClient);
  }, 30000);

  afterAll(async () => {
    await app.close();
    await prismaClient.$disconnect();
  }, 30000);

  it('returns all users', async () => {
    const user = await loginWithFKMAccount(app, {
      username: 'admin',
      password: 'admin',
    });
    const response = await request(app.getHttpServer())
      .get('/user')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(response.body).toEqual([
      {
        id: expect.any(String),
        username: 'admin',
        fullName: 'Admin',
        role: 'ADMIN',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        isWcaAdmin: false,
        wcaUserId: null,
      },
    ]);
  });

  it('creates FKM user', async () => {
    const user = await loginWithFKMAccount(app, {
      username: 'admin',
      password: 'admin',
    });
    await request(app.getHttpServer())
      .post('/user')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        username: 'newuser',
        fullName: 'New User',
        password: 'newpassword',
        role: 'ADMIN',
      })
      .expect(201);

    const userFromDb = await prismaClient.user.findFirst({
      where: {
        username: 'newuser',
      },
    });

    userId = userFromDb.id;
  });

  it('creates WCA user', async () => {
    const user = await loginWithFKMAccount(app, {
      username: 'admin',
      password: 'admin',
    });
    await request(app.getHttpServer())
      .post('/user')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        fullName: 'WCA User',
        wcaUserId: 100,
        role: 'ADMIN',
      })
      .expect(201);
  });

  it('updates a user', async () => {
    const user = await loginWithFKMAccount(app, {
      username: 'admin',
      password: 'admin',
    });
    await request(app.getHttpServer())
      .put(`/user/${userId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        fullName: 'Updated User',
        role: 'ADMIN',
      })
      .expect(200);
  });

  it('updates a user password', async () => {
    const user = await loginWithFKMAccount(app, {
      username: 'admin',
      password: 'admin',
    });
    await request(app.getHttpServer())
      .put(`/user/password/${userId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        password: 'newpassword',
      })
      .expect(200);
  });

  it('deletes a user', async () => {
    const user = await loginWithFKMAccount(app, {
      username: 'admin',
      password: 'admin',
    });
    await request(app.getHttpServer())
      .delete(`/user/${userId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(204);
  });
});
