import { INestApplication } from '@nestjs/common';
import { mkdtempSync, promises as fs, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { Socket } from 'socket.io-client';
import { AppGateway } from 'src/app.gateway';
import { DbService } from 'src/db/db.service';
import { deviceLogFileName } from 'src/device/deviceLog';
import { deviceLogsRoom } from 'src/device/deviceLog.gateway';
import { DeviceLogService } from 'src/device/deviceLog.service';
import * as request from 'supertest';

import { Role } from '../src/generated/prisma/client';
import { createTestApp } from './helpers/app.helper';
import {
  connectSocketIo,
  isSocketInRoom,
  listenOnRandomPort,
  waitForEvent,
  waitForRoomMembership,
} from './helpers/socketio.helper';
import { StationFixtures } from './helpers/station-fixtures.helper';

// Invented hardware ids, unique to this spec
const ESP = { withLog: 0x7a3001, withoutLog: 0x7a3002 };

describe('device logs (e2e, SPEC-009)', () => {
  const originalDir = process.env.DEVICE_LOGS_DIR;
  let app: INestApplication;
  let db: DbService;
  let gateway: AppGateway;
  let logs: DeviceLogService;
  let url: string;
  let adminToken: string;
  let organizerToken: string;
  let fixtures: StationFixtures;
  let dir: string;
  let deviceId: string;
  let deviceWithoutLogId: string;
  let deviceWithoutEspId: string;
  const sockets: Socket[] = [];

  const connect = async (token?: string) => {
    const socket = await connectSocketIo(url, token);
    sockets.push(socket);
    return socket;
  };

  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'fkmtime-device-logs-e2e-'));
    process.env.DEVICE_LOGS_DIR = dir;
    ({ app, db, adminToken } = await createTestApp());
    url = await listenOnRandomPort(app);
    gateway = app.get(AppGateway, { strict: false });
    logs = app.get(DeviceLogService, { strict: false });
    fixtures = new StationFixtures(db, 'e2e-device-logs');
    await fixtures.purgeLeftovers([]);

    const room = await fixtures.createRoom('room', []);
    deviceId = (await fixtures.createDevice('station', ESP.withLog, room.id))
      .id;
    deviceWithoutLogId = (
      await fixtures.createDevice('no-log', ESP.withoutLog, room.id)
    ).id;
    deviceWithoutEspId = (
      await db.device.create({
        data: {
          name: 'e2e-device-logs-no-esp',
          type: 'STATION',
          room: { connect: { id: room.id } },
        },
      })
    ).id;
    organizerToken = await fixtures.createUserToken(app, 'organizer', [
      Role.ORGANIZER,
    ]);

    await fs.writeFile(
      path.join(dir, deviceLogFileName(ESP.withLog)),
      'first line\nsecond line\n',
    );
  }, 30000);

  afterAll(async () => {
    sockets.forEach((s) => s.close());
    await db?.device.deleteMany({ where: { id: deviceWithoutEspId } });
    await fixtures?.cleanup();
    await app?.close();
    rmSync(dir, { recursive: true, force: true });
    if (originalDir === undefined) delete process.env.DEVICE_LOGS_DIR;
    else process.env.DEVICE_LOGS_DIR = originalDir;
  }, 30000);

  describe('joinDeviceLogs', () => {
    it('rejects an organiser', async () => {
      const socket = await connect(organizerToken);
      const exception = waitForEvent(socket, 'exception');

      socket.emit('joinDeviceLogs', { deviceId });

      expect(await exception).toMatchObject({ status: 'error' });
      expect(
        await isSocketInRoom(gateway, deviceLogsRoom(deviceId), socket),
      ).toBe(false);
    });

    it('rejects a connection without a token', async () => {
      const socket = await connect();
      const exception = waitForEvent(socket, 'exception');

      socket.emit('joinDeviceLogs', { deviceId });

      expect(await exception).toMatchObject({ status: 'error' });
    });

    it('sends an admin the recent lines, then new ones, and stops after leaving', async () => {
      const socket = await connect(adminToken);
      const snapshot = waitForEvent(socket, 'deviceLogSnapshot');

      socket.emit('joinDeviceLogs', { deviceId });

      expect(await snapshot).toEqual({
        deviceId,
        available: true,
        lines: ['first line', 'second line'],
        truncated: false,
      });

      const next = waitForEvent(socket, 'deviceLogLines');
      await fs.appendFile(
        path.join(dir, deviceLogFileName(ESP.withLog)),
        'third line\n',
      );
      await logs.pollNow(deviceId);
      expect(await next).toEqual({
        deviceId,
        lines: ['third line'],
        skipped: 0,
      });

      socket.emit('leaveDeviceLogs', { deviceId });
      await waitForRoomMembership(
        gateway,
        deviceLogsRoom(deviceId),
        socket,
        false,
      );
      expect(logs.isFollowing(deviceId)).toBe(false);
    });
  });

  describe('GET /device/:id/logs', () => {
    it('downloads the whole file for an admin', async () => {
      const res = await request(app.getHttpServer())
        .get(`/device/${deviceId}/logs`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.text).toBe('first line\nsecond line\nthird line\n');
      expect(res.headers['content-type']).toMatch(/^text\/plain/);
      expect(res.headers['content-disposition']).toMatch(
        /^attachment; filename="e2e-device-logs-station-\d{4}-\d{2}-\d{2}\.log"$/,
      );
    });

    it('is forbidden for an organiser', async () => {
      await request(app.getHttpServer())
        .get(`/device/${deviceId}/logs`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .expect(403);
    });

    it('is not found for a device without a file', async () => {
      await request(app.getHttpServer())
        .get(`/device/${deviceWithoutLogId}/logs`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('is not found for a device without an esp id', async () => {
      await request(app.getHttpServer())
        .get(`/device/${deviceWithoutEspId}/logs`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('is unavailable without DEVICE_LOGS_DIR', async () => {
      delete process.env.DEVICE_LOGS_DIR;
      try {
        await request(app.getHttpServer())
          .get(`/device/${deviceId}/logs`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(503);
      } finally {
        process.env.DEVICE_LOGS_DIR = dir;
      }
    });
  });
});
