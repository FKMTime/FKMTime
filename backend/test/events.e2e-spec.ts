import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { AppModule } from 'src/app.module';
import { eventsData } from 'src/events';
import * as request from 'supertest';

import { loginWithFKMAccount } from './helpers/auth.helper';

describe('EventsController (e2e)', () => {
  let app: INestApplication;
  let prismaClient: PrismaClient;

  let eventId = '';

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

  it('returns all events', async () => {
    const response = await request(app.getHttpServer())
      .get('/events')
      .expect(200);

    expect(response.body).toEqual(eventsData);
  });

  describe('Unofficial events', () => {
    it('create an unofficial event', async () => {
      const user = await loginWithFKMAccount(app, {
        username: 'admin',
        password: 'admin',
      });

      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          eventId: 'fto',
          rounds: [
            {
              id: 'fto-r1',
              timeLimit: {
                centiseconds: 60000,
                cumulativeRoundIds: [],
              },
              cutoff: null,
              results: [],
              format: 'a',
              advancementCondition: null,
              extensions: [],
            },
          ],
        })
        .expect(201);
    });

    it('returns all unofficial events', async () => {
      const user = await loginWithFKMAccount(app, {
        username: 'admin',
        password: 'admin',
      });

      const response = await request(app.getHttpServer())
        .get('/events/unofficial')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      eventId = response.body[0].id;
    });
  });

  it('updates an unofficial event', async () => {
    const user = await loginWithFKMAccount(app, {
      username: 'admin',
      password: 'admin',
    });

    await request(app.getHttpServer())
      .put(`/events/${eventId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        wcif: {
          id: 'fto',
          rounds: [
            {
              id: 'fto-r1',
              timeLimit: {
                centiseconds: 60000,
                cumulativeRoundIds: [],
              },
              cutoff: null,
              results: [],
              format: 'a',
              advancementCondition: null,
              extensions: [],
            },
          ],
          extensions: [],
          qualification: null,
        },
      })
      .expect(200);
  });

  it('deletes an unofficial event', async () => {
    const user = await loginWithFKMAccount(app, {
      username: 'admin',
      password: 'admin',
    });

    await request(app.getHttpServer())
      .delete(`/events/${eventId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(204);
  });
});
