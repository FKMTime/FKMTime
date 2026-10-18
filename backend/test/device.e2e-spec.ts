import { INestApplication } from '@nestjs/common';
import { HardwareVersion } from '@prisma/client';
import { DbService } from 'src/db/db.service';
import * as request from 'supertest';

import { createTestApp } from './helpers/app.helper';

describe('DeviceController (e2e)', () => {
  let app: INestApplication;
  let db: DbService;
  let adminToken: string;
  let roomId: string;
  let deviceId: string;

  beforeAll(async () => {
    ({ app, db, adminToken } = await createTestApp());
    const room = await db.room.findFirst();
    roomId = room.id;
  }, 30000);

  afterAll(async () => {
    await db.device.deleteMany({ where: { name: { startsWith: 'e2e-' } } });
    await app.close();
  }, 30000);

  describe('POST /device', () => {
    it('creates a device', async () => {
      const res = await request(app.getHttpServer())
        .post('/device')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'e2e-station-1',
          espId: 99001,
          roomId,
          type: 'STATION',
          hwVersion: HardwareVersion.V3,
        })
        .expect(201);

      expect(res.body).toMatchObject({
        name: 'e2e-station-1',
        espId: 99001,
        type: 'STATION',
      });
      deviceId = res.body.id;
    });

    it('returns 409 on duplicate name or espId', async () => {
      await request(app.getHttpServer())
        .post('/device')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'e2e-station-1',
          espId: 99002,
          roomId,
          type: 'STATION',
          hwVersion: HardwareVersion.V3,
        })
        .expect(409);
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .post('/device')
        .send({
          name: 'e2e-station-x',
          espId: 99099,
          roomId,
          type: 'STATION',
          hwVersion: HardwareVersion.V3,
        })
        .expect(401);
    });
  });

  describe('GET /device', () => {
    it('returns device list', async () => {
      const res = await request(app.getHttpServer())
        .get('/device')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((d: any) => d.name === 'e2e-station-1')).toBe(true);
    });

    it('filters by type', async () => {
      const res = await request(app.getHttpServer())
        .get('/device?type=STATION')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      res.body.forEach((d: any) => expect(d.type).toBe('STATION'));
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer()).get('/device').expect(401);
    });
  });

  describe('PUT /device/:id', () => {
    it('updates a device', async () => {
      const res = await request(app.getHttpServer())
        .put(`/device/${deviceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'e2e-station-1-updated',
          espId: 99001,
          roomId,
          type: 'STATION',
          hwVersion: HardwareVersion.V3,
        })
        .expect(200);

      expect(res.body).toHaveProperty('message');
    });

    it('returns 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .put(`/device/${deviceId}`)
        .send({
          name: 'unauthorized',
          espId: 99001,
          roomId,
          type: 'STATION',
          hwVersion: HardwareVersion.V3,
        })
        .expect(401);
    });
  });

  describe('DELETE /device/:id', () => {
    it('deletes a device', async () => {
      await request(app.getHttpServer())
        .delete(`/device/${deviceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      const gone = await db.device.findUnique({ where: { id: deviceId } });
      expect(gone).toBeNull();
      deviceId = null;
    });

    it('returns 401 when not authenticated', async () => {
      const device = await db.device.create({
        data: {
          name: 'e2e-to-delete',
          espId: 99003,
          room: { connect: { id: roomId } },
          type: 'STATION',
          hwVersion: HardwareVersion.V3,
        },
      });

      await request(app.getHttpServer())
        .delete(`/device/${device.id}`)
        .expect(401);

      await db.device.delete({ where: { id: device.id } });
    });
  });
});
