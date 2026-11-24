import { INestApplication } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import { Competition } from 'wcif-helpers';

import {
  disconnectSeedDb,
  seedDb,
  seedH2hBracket,
} from '../prisma/seed/seed-test';
import { DeviceType, StaffRole } from '../src/generated/prisma/client';
import { createTestApp } from './helpers/app.helper';

describe('Test seed (e2e)', () => {
  let app: INestApplication;
  let db: DbService;

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
  }, 30000);

  afterAll(async () => {
    await disconnectSeedDb();
    await app.close();
  });

  it('seeds again after a station was added and used', async () => {
    const room = await db.room.findFirstOrThrow();
    const person = await db.person.findFirstOrThrow();
    const station = await db.device.create({
      data: {
        name: 'e2e-seed-station',
        espId: 990001,
        type: DeviceType.STATION,
        roomId: room.id,
      },
    });
    // What kept the station, and with it its room, from being deleted
    const result = await db.result.create({
      data: { personId: person.id, eventId: '333', roundId: '333-r9' },
    });
    await db.attempt.create({
      data: {
        resultId: result.id,
        attemptNumber: 1,
        value: 1234,
        deviceId: station.id,
      },
    });
    await db.staffActivity.create({
      data: {
        personId: person.id,
        groupId: '333-r9-g1',
        role: StaffRole.JUDGE,
        deviceId: station.id,
      },
    });

    await seedDb();

    expect(await db.device.count({ where: { id: station.id } })).toBe(0);
    expect(await db.competition.count()).toBe(1);
    expect(await db.room.count()).toBeGreaterThan(0);
  }, 60000);

  it("seeds the head-to-head round's bracket, again after a point used an attempt", async () => {
    const bracket = await db.h2hBracket.findFirstOrThrow({
      include: { matches: { orderBy: { matchNumber: 'asc' } }, entrants: true },
    });
    const entrant = bracket.entrants[0];
    // What would keep the point's attempt, and its person, from being deleted
    const result = await db.result.create({
      data: {
        personId: entrant.personId,
        eventId: bracket.eventId,
        roundId: bracket.roundId,
      },
    });
    const attempt = await db.attempt.create({
      data: { resultId: result.id, attemptNumber: 1, value: 1234 },
    });
    await db.h2hSet.create({
      data: {
        matchId: bracket.matches[0].id,
        setNumber: 1,
        points: { create: { pointNumber: 1, attemptAId: attempt.id } },
      },
    });

    await seedDb();

    const seeded = await db.h2hBracket.findFirstOrThrow({
      include: { entrants: true },
    });
    expect(seeded.roundId).toBe(bracket.roundId);
    expect(seeded.status).toBe('SEEDED');
    expect(seeded.entrants).toHaveLength(seeded.size);
    expect(await db.attempt.count({ where: { id: attempt.id } })).toBe(0);
  }, 60000);

  it('seeds no bracket when the WCIF has no head-to-head round', async () => {
    const competition = await db.competition.findFirstOrThrow();
    const wcif = competition.wcif as unknown as Competition;
    await db.h2hBracket.deleteMany();

    await seedH2hBracket({
      ...wcif,
      events: wcif.events.map((event) => ({
        ...event,
        rounds: event.rounds.map((round) => ({ ...round, format: 'a' })),
      })),
    });

    expect(await db.h2hBracket.count()).toBe(0);
    await seedH2hBracket(wcif);
    expect(await db.h2hBracket.count()).toBe(1);
  }, 60000);
});
