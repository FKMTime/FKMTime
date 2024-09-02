import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { AppModule } from 'src/app.module';

describe('AuthController (e2e)', () => {
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

  describe('FKM Auth', () => {
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
  });
});
