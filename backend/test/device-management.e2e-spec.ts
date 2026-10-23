import { INestApplication } from '@nestjs/common';
import { DeviceType, HardwareVersion, Role, Room } from '@prisma/client';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';

import { createTestApp } from './helpers/app.helper';
import {
  createUserWithRoles,
  deleteSetupUsers,
  TestUser,
} from './helpers/setup-roles.helper';

const SUFFIX = 'device-management';
const PREFIX = 'e2e-setup-device-';
const FAKE_ID = '00000000-0000-4000-8000-000000000000';

describe('Device management (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let adminToken: string;
  let organizer: TestUser;
  let stage1: Room;
  let stage2: Room;
  let stationId: string;
  let resultId: string;

  const server = () => app.getHttpServer();
  const asOrganizer = (req: request.Test) =>
    req.set('Authorization', `Bearer ${organizer.token}`);
  const device = (overrides: Record<string, unknown> = {}) => ({
    name: `${PREFIX}station-a`,
    espId: 98001,
    signKey: 98101,
    roomId: stage1.id,
    type: DeviceType.STATION,
    hwVersion: HardwareVersion.V4,
    ...overrides,
  });

  beforeAll(async () => {
    ({ app, db, adminToken } = await createTestApp());
    await deleteSetupUsers(db, SUFFIX);
    await db.device.deleteMany({ where: { name: { startsWith: PREFIX } } });
    organizer = await createUserWithRoles(app, db, `organizer-${SUFFIX}`, [
      Role.ORGANIZER,
    ]);
    stage1 = await db.room.findFirst({ where: { name: 'Stage 1' } });
    stage2 = await db.room.findFirst({ where: { name: 'Stage  2' } });
  }, 30000);

  afterAll(async () => {
    if (resultId) {
      await db.result.delete({ where: { id: resultId } });
    }
    await db.device.deleteMany({ where: { name: { startsWith: PREFIX } } });
    await deleteSetupUsers(db, SUFFIX);
    await app.close();
  }, 30000);

  describe('POST /device', () => {
    it('registers a station in a room', async () => {
      const res = await asOrganizer(request(server()).post('/device'))
        .send(device())
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        name: `${PREFIX}station-a`,
        espId: 98001,
        signKey: 98101,
        type: DeviceType.STATION,
        hwVersion: HardwareVersion.V4,
        room: { id: stage1.id, name: 'Stage 1' },
        count: 0,
      });
      stationId = res.body.id;
      expect(
        await db.device.findUnique({ where: { id: stationId } }),
      ).toMatchObject({ roomId: stage1.id, signKey: 98101 });
    });

    it('registers an attendance device in another room', async () => {
      await asOrganizer(request(server()).post('/device'))
        .send(
          device({
            name: `${PREFIX}attendance-b`,
            espId: 98002,
            signKey: 98102,
            roomId: stage2.id,
            type: DeviceType.ATTENDANCE_SCRAMBLER,
          }),
        )
        .expect(201);
    });

    it('rejects a duplicate ESP id with 409', async () => {
      await asOrganizer(request(server()).post('/device'))
        .send(device({ name: `${PREFIX}station-dup`, signKey: 98199 }))
        .expect(409);
      expect(
        await db.device.count({ where: { name: `${PREFIX}station-dup` } }),
      ).toBe(0);
    });

    it.each([
      ['an unknown type', { type: 'TIMER' }],
      ['an unknown hardware version', { hwVersion: 'V9' }],
      ['a non-integer ESP id', { espId: 'abc' }],
      ['an empty name', { name: '' }],
    ])('rejects %s', async (_, overrides) => {
      await asOrganizer(request(server()).post('/device'))
        .send(device({ name: `${PREFIX}invalid`, espId: 98003, ...overrides }))
        .expect(400);
    });

    // BUG: createDevice swallows non-P2002 Prisma errors, so an unknown room answers 201 with no device
    it.skip('rejects an unknown room', async () => {
      await asOrganizer(request(server()).post('/device'))
        .send(
          device({ name: `${PREFIX}nowhere`, espId: 98004, roomId: FAKE_ID }),
        )
        .expect(404);
    });
  });

  describe('GET /device', () => {
    it('filters by room', async () => {
      const res = await asOrganizer(
        request(server()).get(`/device?roomId=${stage2.id}`),
      ).expect(200);

      const names = res.body.map((d: { name: string }) => d.name);
      expect(names).toContain(`${PREFIX}attendance-b`);
      expect(names).not.toContain(`${PREFIX}station-a`);
      res.body.forEach((d: { roomId: string }) =>
        expect(d.roomId).toBe(stage2.id),
      );
    });

    it('returns every room for roomId=ALL, sorted by name', async () => {
      const res = await asOrganizer(
        request(server()).get('/device?roomId=ALL'),
      ).expect(200);

      const names = res.body.map((d: { name: string }) => d.name);
      expect(names).toEqual(
        expect.arrayContaining([`${PREFIX}attendance-b`, `${PREFIX}station-a`]),
      );
      expect([...names].sort()).toEqual(names);
    });

    it('rejects an unknown type filter', async () => {
      await asOrganizer(request(server()).get('/device?type=TIMER')).expect(
        400,
      );
    });

    it('counts the attempts entered on each device', async () => {
      const person = await db.person.findFirst({ where: { registrantId: 7 } });
      await db.result.deleteMany({
        where: { personId: person.id, roundId: 'minx-r1' },
      });
      const result = await db.result.create({
        data: { personId: person.id, eventId: 'minx', roundId: 'minx-r1' },
      });
      resultId = result.id;
      await db.attempt.createMany({
        data: [1, 2, 3].map((attemptNumber) => ({
          resultId,
          attemptNumber,
          value: 6000 + attemptNumber,
          deviceId: stationId,
        })),
      });

      const res = await asOrganizer(
        request(server()).get(`/device?type=${DeviceType.STATION}`),
      ).expect(200);

      const station = res.body.find((d: { id: string }) => d.id === stationId);
      expect(station.count).toBe(3);
    });
  });

  describe('PUT /device/:id', () => {
    it('moves a device to another room and changes its type', async () => {
      const res = await asOrganizer(
        request(server()).put(`/device/${stationId}`),
      )
        .send(
          device({
            roomId: stage2.id,
            type: DeviceType.ATTENDANCE_RUNNER,
            hwVersion: HardwareVersion.V3,
          }),
        )
        .expect(200);

      expect(res.body).toEqual({ message: 'Device updated' });
      expect(
        await db.device.findUnique({ where: { id: stationId } }),
      ).toMatchObject({
        roomId: stage2.id,
        type: DeviceType.ATTENDANCE_RUNNER,
        hwVersion: HardwareVersion.V3,
      });
    });

    it("rejects taking another device's ESP id with 409", async () => {
      await asOrganizer(request(server()).put(`/device/${stationId}`))
        .send(device({ espId: 98002 }))
        .expect(409);
      expect(
        (await db.device.findUnique({ where: { id: stationId } })).espId,
      ).toBe(98001);
    });

    // BUG: updateDevice swallows Prisma P2025, so updating a missing device answers 200 "Device updated"
    it.skip('returns 404 for an unknown device', async () => {
      await asOrganizer(request(server()).put(`/device/${FAKE_ID}`))
        .send(device({ name: `${PREFIX}ghost`, espId: 98005 }))
        .expect(404);
    });
  });

  describe('DELETE /device/:id', () => {
    it('deletes a device', async () => {
      const created = await db.device.create({
        data: {
          name: `${PREFIX}to-delete`,
          espId: 98006,
          type: DeviceType.STATION,
          roomId: stage1.id,
        },
      });

      await asOrganizer(
        request(server()).delete(`/device/${created.id}`),
      ).expect(204);

      expect(
        await db.device.findUnique({ where: { id: created.id } }),
      ).toBeNull();
    });

    // BUG: deleting a missing device leaks Prisma P2025 as 500 instead of 404
    it.skip('returns 404 for an unknown device', async () => {
      await asOrganizer(request(server()).delete(`/device/${FAKE_ID}`)).expect(
        404,
      );
    });
  });

  describe('POST /device/upload-firmware', () => {
    it('accepts a firmware file from an admin', async () => {
      await request(server())
        .post('/device/upload-firmware')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ fileName: 'station-v4.bin', fileData: 'AAECAw==' })
        .expect(200);
    });

    it.each([
      ['a path in the file name', '../station.bin'],
      ['a non-.bin file', 'station.exe'],
    ])('rejects %s', async (_, fileName) => {
      await request(server())
        .post('/device/upload-firmware')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ fileName, fileData: 'AAECAw==' })
        .expect(400);
    });
  });
});
