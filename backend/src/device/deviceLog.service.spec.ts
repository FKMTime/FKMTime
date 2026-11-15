import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { mkdtempSync, promises as fs, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { Readable } from 'stream';

import { deviceLogFileName } from './deviceLog';
import { DeviceLogListener, DeviceLogService } from './deviceLog.service';

const ESP_ID = 0x5a5a;
const DEVICE_ID = 'device-1';

const readAll = async (stream: Readable) => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
};

describe('DeviceLogService', () => {
  const originalDir = process.env.DEVICE_LOGS_DIR;
  let dir: string;
  let file: string;
  let service: DeviceLogService;
  let findUnique: jest.Mock;

  const listener = (watchers = 1) => {
    const state = { watchers };
    const result: DeviceLogListener & { state: typeof state } = {
      state,
      hasWatchers: () => state.watchers > 0,
      onLines: jest.fn(),
      onSnapshot: jest.fn(),
    };
    return result;
  };

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'fkmtime-device-logs-'));
    file = path.join(dir, deviceLogFileName(ESP_ID));
    process.env.DEVICE_LOGS_DIR = dir;
    findUnique = jest
      .fn()
      .mockResolvedValue({ espId: ESP_ID, name: 'Station 1' });
    service = new DeviceLogService({ device: { findUnique } } as never);
  });

  afterEach(() => {
    service.onModuleDestroy();
    rmSync(dir, { recursive: true, force: true });
    if (originalDir === undefined) delete process.env.DEVICE_LOGS_DIR;
    else process.env.DEVICE_LOGS_DIR = originalDir;
  });

  describe('watch', () => {
    it('is unavailable without DEVICE_LOGS_DIR, and follows nothing', async () => {
      delete process.env.DEVICE_LOGS_DIR;

      expect(await service.watch(DEVICE_ID, listener())).toEqual({
        deviceId: DEVICE_ID,
        available: false,
        lines: [],
        truncated: false,
      });
      expect(service.isFollowing(DEVICE_ID)).toBe(false);
    });

    it('is empty for a device without an esp id', async () => {
      findUnique.mockResolvedValue({ espId: null, name: 'Station 1' });

      expect(await service.watch(DEVICE_ID, listener())).toMatchObject({
        available: true,
        lines: [],
      });
      expect(service.isFollowing(DEVICE_ID)).toBe(false);
    });

    it('sends the recent lines, then new ones as they are written', async () => {
      await fs.writeFile(file, 'one\ntwo\n');
      const watcher = listener();

      expect(await service.watch(DEVICE_ID, watcher)).toMatchObject({
        available: true,
        lines: ['one', 'two'],
        truncated: false,
      });

      await fs.appendFile(file, 'three\n');
      await service.pollNow(DEVICE_ID);

      expect(watcher.onLines).toHaveBeenCalledWith({
        deviceId: DEVICE_ID,
        lines: ['three'],
        skipped: 0,
      });
    });

    it('gives a second watcher the lines up to where the follower is', async () => {
      await fs.writeFile(file, 'one\n');
      await service.watch(DEVICE_ID, listener());
      // Written but not polled yet: the room gets it with the next poll
      await fs.appendFile(file, 'two\n');

      const second = await service.watch(DEVICE_ID, listener(2));

      expect(second.lines).toEqual(['one']);
    });

    it('sends a fresh snapshot to the room when the file shrinks', async () => {
      await fs.writeFile(file, 'one\ntwo\n');
      const watcher = listener();
      await service.watch(DEVICE_ID, watcher);
      await fs.writeFile(file, 'new\n');

      await service.pollNow(DEVICE_ID);

      expect(watcher.onSnapshot).toHaveBeenCalledWith({
        deviceId: DEVICE_ID,
        available: true,
        lines: ['new'],
        truncated: false,
      });
    });

    it('stops following once nobody watches', async () => {
      await fs.writeFile(file, 'one\n');
      const watcher = listener();
      await service.watch(DEVICE_ID, watcher);

      service.release(DEVICE_ID);
      expect(service.isFollowing(DEVICE_ID)).toBe(true);

      watcher.state.watchers = 0;
      service.release(DEVICE_ID);
      expect(service.isFollowing(DEVICE_ID)).toBe(false);
    });

    it('stops following when the last watcher disconnected without leaving', async () => {
      await fs.writeFile(file, 'one\n');
      const watcher = listener();
      await service.watch(DEVICE_ID, watcher);
      watcher.state.watchers = 0;

      await service.pollNow(DEVICE_ID);

      expect(service.isFollowing(DEVICE_ID)).toBe(false);
    });
  });

  describe('download', () => {
    it('streams the file up to the size it had when asked', async () => {
      await fs.writeFile(file, 'one\ntwo\n');

      const download = await service.download(
        DEVICE_ID,
        new Date('2026-03-04T00:00:00Z'),
      );
      await fs.appendFile(file, 'written meanwhile\n');

      expect(await readAll(download.getStream())).toBe('one\ntwo\n');
      expect(download.getHeaders()).toMatchObject({
        type: 'text/plain; charset=utf-8',
        disposition: 'attachment; filename="Station-1-2026-03-04.log"',
        length: 8,
      });
    });

    it('is not found for a device without a file', async () => {
      await expect(service.download(DEVICE_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('is not found for a device without an esp id', async () => {
      findUnique.mockResolvedValue({ espId: null, name: 'Station 1' });

      await expect(service.download(DEVICE_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('is unavailable without DEVICE_LOGS_DIR', async () => {
      delete process.env.DEVICE_LOGS_DIR;

      await expect(service.download(DEVICE_ID)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });
});
