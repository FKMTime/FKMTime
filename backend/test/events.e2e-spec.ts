import { INestApplication } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import { eventsData } from 'src/events';
import * as request from 'supertest';

import { createTestApp } from './helpers/app.helper';

describe('EventsController (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let adminToken: string;
  let eventId = '';

  beforeAll(async () => {
    ({ app, db, adminToken } = await createTestApp());
  }, 30000);

  afterAll(async () => {
    await db.unofficialEvent.deleteMany({ where: { eventId: 'fto' } });
    await app.close();
  }, 30000);

  it('returns all events', async () => {
    const response = await request(app.getHttpServer())
      .get('/events')
      .expect(200);

    expect(response.body).toEqual(eventsData);
  });

  describe('Unofficial events', () => {
    it('create an unofficial event', async () => {
      await request(app.getHttpServer())
        .post('/events')
        .set('Authorization', `Bearer ${adminToken}`)
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
              linkedRounds: null,
              participationRuleset: null,
              scrambleSetCount: 0,
              scrambleSets: [],
              extensions: [],
            },
          ],
        })
        .expect(201);
    });

    it('returns all unofficial events', async () => {
      const response = await request(app.getHttpServer())
        .get('/events/unofficial')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      eventId = response.body[0].id;
    });
  });

  it('updates an unofficial event', async () => {
    await request(app.getHttpServer())
      .put(`/events/${eventId}`)
      .set('Authorization', `Bearer ${adminToken}`)
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
              linkedRounds: null,
              participationRuleset: null,
              scrambleSetCount: 0,
              scrambleSets: [],
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
    await request(app.getHttpServer())
      .delete(`/events/${eventId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
  });
});
