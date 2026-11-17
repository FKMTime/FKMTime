import { mkdtempSync, promises as fs, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';

import {
  MAX_BATCH_LINES,
  pollFile,
  readTail,
  SNAPSHOT_BYTES,
  SNAPSHOT_LINES,
} from '../logging/logFile';
import {
  deviceLogFileName,
  deviceLogsDir,
  downloadFileName,
} from './deviceLog';

const line = (n: number) =>
  `2026-01-01T10:00:00.000000Z  INFO backend::handler: line ${n}`;
const lines = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => line(from + i));

describe('device log files', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'fkmtime-device-logs-'));
    file = path.join(dir, deviceLogFileName(0xabc));
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const write = (text: string) => fs.writeFile(file, text);
  const append = (text: string) => fs.appendFile(file, text);

  it('names the file after the esp id in upper-case hex without padding', () => {
    expect(deviceLogFileName(0x2806c23)).toBe('device_2806C23.log');
    expect(deviceLogFileName(255)).toBe('device_FF.log');
  });

  describe('deviceLogsDir', () => {
    const original = process.env.DEVICE_LOGS_DIR;
    afterEach(() => {
      if (original === undefined) delete process.env.DEVICE_LOGS_DIR;
      else process.env.DEVICE_LOGS_DIR = original;
    });

    it('is null without DEVICE_LOGS_DIR', async () => {
      delete process.env.DEVICE_LOGS_DIR;
      expect(await deviceLogsDir()).toBeNull();
    });

    it('is null when the folder is missing', async () => {
      process.env.DEVICE_LOGS_DIR = path.join(dir, 'missing');
      expect(await deviceLogsDir()).toBeNull();
    });

    it('is the folder when it exists', async () => {
      process.env.DEVICE_LOGS_DIR = dir;
      expect(await deviceLogsDir()).toBe(dir);
    });
  });

  describe('readTail', () => {
    it('is empty for a file that does not exist yet', async () => {
      expect(await readTail(file)).toEqual({
        lines: [],
        truncated: false,
        offset: 0,
        ino: null,
      });
    });

    it('returns every line of a small file and leaves a partial one for later', async () => {
      await write(`${line(1)}\n${line(2)}\n${line(3)}`);

      const tail = await readTail(file);

      expect(tail.lines).toEqual([line(1), line(2)]);
      expect(tail.truncated).toBe(false);
      expect(tail.offset).toBe(`${line(1)}\n${line(2)}\n`.length);
    });

    it('returns the last lines of a big file and never starts mid-line', async () => {
      const count = Math.ceil(SNAPSHOT_BYTES / line(0).length) + 100;
      await write(lines(1, count).join('\n') + '\n');

      const tail = await readTail(file);

      expect(tail.lines).toHaveLength(SNAPSHOT_LINES);
      expect(tail.lines[0]).toBe(line(count - SNAPSHOT_LINES + 1));
      expect(tail.lines.at(-1)).toBe(line(count));
      expect(tail.truncated).toBe(true);
    });

    it('drops a partial first line when reading from the middle', async () => {
      await write(lines(1, 20).join('\n') + '\n');

      const tail = await readTail(file, undefined, 100, 30);

      expect(tail.lines.every((l) => l.startsWith('2026-'))).toBe(true);
      expect(tail.truncated).toBe(true);
    });

    it('marks a file with more lines than the snapshot holds as truncated', async () => {
      await write(lines(1, 5).join('\n') + '\n');

      const tail = await readTail(file, undefined, 3);

      expect(tail.lines).toEqual(lines(3, 3));
      expect(tail.truncated).toBe(true);
    });

    it('stops at endAt', async () => {
      await write(lines(1, 3).join('\n') + '\n');
      const endAt = `${line(1)}\n${line(2)}\n`.length;

      const tail = await readTail(file, endAt);

      expect(tail.lines).toEqual([line(1), line(2)]);
      expect(tail.offset).toBe(endAt);
    });
  });

  describe('pollFile', () => {
    it('sends only complete new lines and keeps a partial one until its newline', async () => {
      await write(`${line(1)}\n`);
      const start = await readTail(file);
      await append(`${line(2)}\nline 3 so f`);

      const first = await pollFile(file, start);
      expect(first).toMatchObject({
        kind: 'lines',
        lines: [line(2)],
        skipped: 0,
      });

      await append('ar\n');
      const position = first.kind === 'lines' ? first.position : start;
      expect(await pollFile(file, position)).toMatchObject({
        kind: 'lines',
        lines: ['line 3 so far'],
      });
    });

    it('reports nothing when the file has not grown', async () => {
      await write(`${line(1)}\n`);
      const start = await readTail(file);

      expect(await pollFile(file, start)).toEqual({ kind: 'none' });
    });

    it('caps a batch and counts the lines it skipped', async () => {
      await write('');
      const start = await readTail(file);
      await append(lines(1, MAX_BATCH_LINES + 5).join('\n') + '\n');

      const result = await pollFile(file, start);

      expect(result).toMatchObject({ kind: 'lines', skipped: 5 });
      if (result.kind !== 'lines') throw new Error('expected lines');
      expect(result.lines).toHaveLength(MAX_BATCH_LINES);
      expect(result.lines[0]).toBe(line(6));
    });

    it('resets when the file shrinks', async () => {
      await write(lines(1, 3).join('\n') + '\n');
      const start = await readTail(file);
      await write(`${line(9)}\n`);

      expect(await pollFile(file, start)).toEqual({ kind: 'reset' });
    });

    it('resets when the file is removed', async () => {
      await write(`${line(1)}\n`);
      const start = await readTail(file);
      await fs.rm(file);

      expect(await pollFile(file, start)).toEqual({ kind: 'reset' });
    });

    it('waits for a missing file, then reads it from the start', async () => {
      const start = await readTail(file);
      expect(await pollFile(file, start)).toEqual({ kind: 'none' });

      await write(`${line(1)}\n`);

      expect(await pollFile(file, start)).toMatchObject({
        kind: 'lines',
        lines: [line(1)],
      });
    });
  });

  describe('downloadFileName', () => {
    const now = new Date('2026-03-04T05:06:07Z');

    it('keeps letters, digits, dashes and underscores', () => {
      expect(downloadFileName('Station_1', now)).toBe(
        'Station_1-2026-03-04.log',
      );
    });

    it('replaces anything that could break the header', () => {
      expect(downloadFileName('Station "A"; x', now)).toBe(
        'Station-A-x-2026-03-04.log',
      );
    });

    it('falls back to "device" when nothing is left', () => {
      expect(downloadFileName('"""', now)).toBe('device-2026-03-04.log');
    });
  });
});
