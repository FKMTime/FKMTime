import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { AppModule } from 'src/app.module';
import * as request from 'supertest';

import { loginWithFKMAccount } from './helpers/auth.helper';

describe('SettingsController (e2e)', () => {
  let app: INestApplication;
  let prismaClient: PrismaClient;

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

  it('returns settings', async () => {
    const user = await loginWithFKMAccount(app, {
      username: 'admin',
      password: 'admin',
    });

    await request(app.getHttpServer())
      .get('/settings')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);
  });

  it('creates a quick action', async () => {
    const user = await loginWithFKMAccount(app, {
      username: 'admin',
      password: 'admin',
    });

    await request(app.getHttpServer())
      .post('/settings/quick-actions')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Test',
        comment: 'Test',
        giveExtra: true,
      })
      .expect(201);
  });

  it('get quick actions', async () => {
    const user = await loginWithFKMAccount(app, {
      username: 'admin',
      password: 'admin',
    });

    const response = await request(app.getHttpServer())
      .get('/settings/quick-actions')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(response.body).toEqual([
      {
        id: expect.any(String),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        isShared: true,
        user: {
          id: expect.any(String),
          fullName: 'Admin',
        },
        userId: expect.any(String),
        name: 'Test',
        comment: 'Test',
        giveExtra: true,
      },
    ]);
  });
});
