import { INestApplication } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';

import { createTestApp } from './helpers/app.helper';
import { listenOnLoopback } from './helpers/loopback.helper';
import {
  createUserWithRoles,
  deleteSetupUsers,
  TestUser,
} from './helpers/setup-roles.helper';

const SUFFIX = 'events-unofficial';
const FAKE_ID = '00000000-0000-4000-8000-000000000000';

const round = (id: string, format = 'a') => ({
  id,
  format,
  timeLimit: { centiseconds: 60000, cumulativeRoundIds: [] },
  cutoff: null,
  advancementCondition: null,
  results: [],
  scrambleSetCount: 1,
  extensions: [],
});

describe('Unofficial events (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let organizer: TestUser;
  let originalWcif: Prisma.JsonValue;
  let competitionId: string;
  let mirrorId: string;
  let resultId: string;

  const server = () => app.getHttpServer();
  const asOrganizer = (req: request.Test) =>
    req.set('Authorization', `Bearer ${organizer.token}`);
  const competitionEvents = async () => {
    const competition = await db.competition.findFirst();
    return (
      competition.wcif as unknown as {
        events: { id: string; rounds: { id: string; format: string }[] }[];
      }
    ).events;
  };

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    await listenOnLoopback(app);
    await deleteSetupUsers(db, SUFFIX);
    await db.unofficialEvent.deleteMany({
      where: { eventId: { in: ['mirror', 'fto'] } },
    });
    organizer = await createUserWithRoles(app, db, `organizer-${SUFFIX}`, [
      Role.ORGANIZER,
    ]);
    const competition = await db.competition.findFirst();
    competitionId = competition.id;
    originalWcif = competition.wcif;
  }, 30000);

  afterAll(async () => {
    if (resultId) {
      await db.result.deleteMany({ where: { id: resultId } });
    }
    await db.unofficialEvent.deleteMany({
      where: { eventId: { in: ['mirror', 'fto'] } },
    });
    await db.competition.update({
      where: { id: competitionId },
      data: { wcif: originalWcif as Prisma.InputJsonValue },
    });
    await deleteSetupUsers(db, SUFFIX);
    await app.close();
  }, 30000);

  it('GET /events lists official and unofficial events without auth', async () => {
    const res = await request(server()).get('/events').expect(200);

    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: '333', name: '3x3x3 Cube' }),
        expect.objectContaining({ id: 'mirror', isUnofficial: true }),
      ]),
    );
  });

  it('creates an unofficial event and adds it to the competition WCIF', async () => {
    const res = await asOrganizer(request(server()).post('/events'))
      .send({ eventId: 'mirror', rounds: [round('mirror-r1')] })
      .expect(201);

    expect(res.body).toEqual({
      message: 'Unofficial event created successfully.',
    });
    const fromDb = await db.unofficialEvent.findUnique({
      where: { eventId: 'mirror' },
    });
    expect(fromDb.wcif).toEqual({
      id: 'mirror',
      rounds: [round('mirror-r1')],
      extensions: [],
      qualification: null,
    });
    mirrorId = fromDb.id;

    const events = await competitionEvents();
    expect(events.map((e) => e.id)).toContain('mirror');
    expect(events.find((e) => e.id === 'mirror').rounds).toEqual([
      round('mirror-r1'),
    ]);
  });

  it('makes the new event show up in the rounds list', async () => {
    const res = await asOrganizer(
      request(server()).get('/competition/rounds'),
    ).expect(200);

    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'mirror-r1',
          eventId: 'mirror',
          name: 'Mirror blocks - Round 1',
        }),
      ]),
    );
  });

  it('rejects creating the same event twice with 409', async () => {
    await asOrganizer(request(server()).post('/events'))
      .send({ eventId: 'mirror', rounds: [] })
      .expect(409);
    expect(
      await db.unofficialEvent.count({ where: { eventId: 'mirror' } }),
    ).toBe(1);
  });

  it.each([
    ['without an event id', { rounds: [] }],
    ['with rounds that are not a list', { eventId: 'mirror', rounds: 'r1' }],
  ])('rejects a create request %s', async (_, body) => {
    await asOrganizer(request(server()).post('/events')).send(body).expect(400);
  });

  it('lists unofficial events', async () => {
    const res = await asOrganizer(
      request(server()).get('/events/unofficial'),
    ).expect(200);

    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: mirrorId, eventId: 'mirror' }),
      ]),
    );
  });

  it('updates the event and its copy in the competition WCIF', async () => {
    const wcif = {
      id: 'mirror',
      rounds: [round('mirror-r1', '3'), round('mirror-r2', '3')],
      extensions: [],
      qualification: null,
    };

    await asOrganizer(request(server()).put(`/events/${mirrorId}`))
      .send({ wcif })
      .expect(200);

    expect(
      (await db.unofficialEvent.findUnique({ where: { id: mirrorId } })).wcif,
    ).toEqual(wcif);
    const mirror = (await competitionEvents()).find((e) => e.id === 'mirror');
    expect(mirror.rounds.map((r) => [r.id, r.format])).toEqual([
      ['mirror-r1', '3'],
      ['mirror-r2', '3'],
    ]);
  });

  it('returns 404 when updating an unknown event', async () => {
    await asOrganizer(request(server()).put(`/events/${FAKE_ID}`))
      .send({ wcif: { id: 'mirror', rounds: [] } })
      .expect(404);
  });

  it('refuses to delete an event that already has results', async () => {
    const person = await db.person.findFirst({ where: { registrantId: 8 } });
    const result = await db.result.create({
      data: { personId: person.id, eventId: 'mirror', roundId: 'mirror-r1' },
    });
    resultId = result.id;

    const res = await asOrganizer(
      request(server()).delete(`/events/${mirrorId}`),
    ).expect(409);

    expect(res.body.message).toBe(
      'Cannot delete unofficial event with results.',
    );
    expect(
      await db.unofficialEvent.findUnique({ where: { id: mirrorId } }),
    ).not.toBeNull();
  });

  it('deletes the event and removes it from the competition WCIF', async () => {
    await db.result.delete({ where: { id: resultId } });
    resultId = undefined;

    await asOrganizer(request(server()).delete(`/events/${mirrorId}`)).expect(
      204,
    );

    expect(
      await db.unofficialEvent.findUnique({ where: { id: mirrorId } }),
    ).toBeNull();
    expect((await competitionEvents()).map((e) => e.id)).not.toContain(
      'mirror',
    );
  });

  it('returns 404 when deleting an unknown event', async () => {
    await asOrganizer(request(server()).delete(`/events/${FAKE_ID}`)).expect(
      404,
    );
  });

  // FTO has been an official WCA event since the WCIF v2 update (#462)
  it.each([
    ['FTO', 'fto'],
    ['3x3x3', '333'],
    ['an unknown event', 'not-an-event'],
  ])('refuses to add %s as an unofficial event', async (_, eventId) => {
    const res = await asOrganizer(request(server()).post('/events'))
      .send({ eventId, rounds: [round(`${eventId}-r1`)] })
      .expect(400);

    expect(res.body.message).toBe(
      'Only unofficial events can be added here. Official events come from the WCA website.',
    );
    expect(await db.unofficialEvent.count({ where: { eventId } })).toBe(0);
  });
});
