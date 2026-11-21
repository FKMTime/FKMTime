import { INestApplication } from '@nestjs/common';
import { mkdtempSync, promises as fs, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { Socket } from 'socket.io-client';
import { AppGateway } from 'src/app.gateway';
import { DbService } from 'src/db/db.service';
import { serverLogsRoom } from 'src/logging/serverLog.gateway';
import { ServerLogService } from 'src/logging/serverLog.service';
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

describe('server logs (e2e, SPEC-011)', () => {
  const originalBackendDir = process.env.BACKEND_LOGS_DIR;
  const originalDeviceDir = process.env.DEVICE_LOGS_DIR;
  let app: INestApplication;
  let db: DbService;
  let gateway: AppGateway;
  let logs: ServerLogService;
  let url: string;
  let adminToken: string;
  let organizerToken: string;
  let fixtures: StationFixtures;
  let backendDir: string;
  let deviceDir: string;
  const sockets: Socket[] = [];

  const connect = async (token?: string) => {
    const socket = await connectSocketIo(url, token);
    sockets.push(socket);
    return socket;
  };
  const restoreEnv = (name: string, value: string | undefined) => {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  };

  beforeAll(async () => {
    backendDir = mkdtempSync(path.join(tmpdir(), 'fkmtime-backend-logs-e2e-'));
    deviceDir = mkdtempSync(path.join(tmpdir(), 'fkmtime-device-logs-e2e-'));
    process.env.BACKEND_LOGS_DIR = backendDir;
    process.env.DEVICE_LOGS_DIR = deviceDir;
    ({ app, db, adminToken } = await createTestApp());
    url = await listenOnRandomPort(app);
    gateway = app.get(AppGateway, { strict: false });
    logs = app.get(ServerLogService, { strict: false });
    fixtures = new StationFixtures(db, 'e2e-server-logs');
    await fixtures.purgeLeftovers([]);
    organizerToken = await fixtures.createUserToken(app, 'organizer', [
      Role.ORGANIZER,
    ]);

    await fs.writeFile(
      path.join(backendDir, 'backend.log'),
      'first line\nsecond line\n',
    );
    await fs.writeFile(path.join(deviceDir, 'unix.log'), 'request\n');
  }, 30000);

  afterAll(async () => {
    sockets.forEach((s) => s.close());
    await fixtures?.cleanup();
    await app?.close();
    rmSync(backendDir, { recursive: true, force: true });
    rmSync(deviceDir, { recursive: true, force: true });
    restoreEnv('BACKEND_LOGS_DIR', originalBackendDir);
    restoreEnv('DEVICE_LOGS_DIR', originalDeviceDir);
  }, 30000);

  describe('joinServerLogs', () => {
    it('rejects an organiser', async () => {
      const socket = await connect(organizerToken);
      const exception = waitForEvent(socket, 'exception');

      socket.emit('joinServerLogs', { source: 'backend' });

      expect(await exception).toMatchObject({ status: 'error' });
      expect(
        await isSocketInRoom(gateway, serverLogsRoom('backend'), socket),
      ).toBe(false);
    });

    it('ignores a source that is not in the list', async () => {
      const socket = await connect(adminToken);
      const snapshot = waitForEvent(socket, 'serverLogSnapshot');

      socket.emit('joinServerLogs', { source: '../../etc/passwd' });
      socket.emit('joinServerLogs', { source: 'unix' });

      // The first and only snapshot is the valid one
      expect(await snapshot).toMatchObject({
        source: 'unix',
        lines: ['request'],
      });
      socket.emit('leaveServerLogs', { source: 'unix' });
    });

    it('sends an admin the recent lines, then new ones, and stops after leaving', async () => {
      const socket = await connect(adminToken);
      const snapshot = waitForEvent(socket, 'serverLogSnapshot');

      socket.emit('joinServerLogs', { source: 'backend' });

      expect(await snapshot).toEqual({
        source: 'backend',
        available: true,
        lines: ['first line', 'second line'],
        truncated: false,
      });

      const next = waitForEvent(socket, 'serverLogLines');
      await fs.appendFile(path.join(backendDir, 'backend.log'), 'third line\n');
      await logs.pollNow('backend');
      expect(await next).toEqual({
        source: 'backend',
        lines: ['third line'],
        skipped: 0,
      });

      socket.emit('leaveServerLogs', { source: 'backend' });
      await waitForRoomMembership(
        gateway,
        serverLogsRoom('backend'),
        socket,
        false,
      );
      expect(logs.isFollowing('backend')).toBe(false);
    });

    it('says the log is unavailable when its folder is missing', async () => {
      delete process.env.BACKEND_LOGS_DIR;
      try {
        const socket = await connect(adminToken);
        const snapshot = waitForEvent(socket, 'serverLogSnapshot');

        socket.emit('joinServerLogs', { source: 'backend' });

        expect(await snapshot).toEqual({
          source: 'backend',
          available: false,
          lines: [],
          truncated: false,
        });
      } finally {
        process.env.BACKEND_LOGS_DIR = backendDir;
      }
    });
  });

  describe('GET /server-logs/:source', () => {
    it('downloads the whole file for an admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/server-logs/backend')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.text).toBe('first line\nsecond line\nthird line\n');
      expect(res.headers['content-type']).toMatch(/^text\/plain/);
      expect(res.headers['content-disposition']).toMatch(
        /^attachment; filename="backend-\d{4}-\d{2}-\d{2}\.log"$/,
      );
    });

    it('is forbidden for an organiser', async () => {
      await request(app.getHttpServer())
        .get('/server-logs/backend')
        .set('Authorization', `Bearer ${organizerToken}`)
        .expect(403);
    });

    it('is a bad request for a source that is not in the list', async () => {
      await request(app.getHttpServer())
        .get('/server-logs/postgres')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('is not found before anything was logged', async () => {
      await request(app.getHttpServer())
        .get('/server-logs/connector')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('is unavailable without its folder', async () => {
      delete process.env.BACKEND_LOGS_DIR;
      try {
        await request(app.getHttpServer())
          .get('/server-logs/backend')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(503);
      } finally {
        process.env.BACKEND_LOGS_DIR = backendDir;
      }
    });
  });
});
