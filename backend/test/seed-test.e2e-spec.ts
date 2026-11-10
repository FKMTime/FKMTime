import { INestApplication } from '@nestjs/common';
import { DeviceType, StaffRole } from '@prisma/client';
import { DbService } from 'src/db/db.service';

import { disconnectSeedDb, seedDb } from '../prisma/seed/seed-test';
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
});
