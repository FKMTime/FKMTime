import { chmodSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';

import {
  BACKEND_LOG_FILE,
  CappedLogFile,
  installBackendLogFile,
} from './backendLogFile';

describe('backend log file', () => {
  let dir: string;
  const read = (name: string) => readFileSync(path.join(dir, name), 'utf8');

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'fkmtime-backend-logs-'));
  });

  afterEach(() => {
    chmodSync(dir, 0o700);
    rmSync(dir, { recursive: true, force: true });
  });

  describe('CappedLogFile', () => {
    it('appends to what is already there', () => {
      const first = new CappedLogFile(path.join(dir, 'a.log'));
      first.write('one\n');
      first.close();
      const second = new CappedLogFile(path.join(dir, 'a.log'));
      second.write('two\n');
      second.close();

      expect(read('a.log')).toBe('one\ntwo\n');
    });

    it('rotates to .1 past the cap, keeping one older file', () => {
      const file = new CappedLogFile(path.join(dir, 'a.log'), 8);
      file.write('aaaa\n');
      file.write('bbbb\n');
      expect(read('a.log')).toBe('bbbb\n');
      expect(read('a.log.1')).toBe('aaaa\n');

      file.write('cccc\n');
      file.close();
      expect(read('a.log')).toBe('cccc\n');
      expect(read('a.log.1')).toBe('bbbb\n');
    });

    it('turns itself off on an error instead of throwing', () => {
      chmodSync(dir, 0o500);
      const onError = jest.fn();

      const file = new CappedLogFile(path.join(dir, 'a.log'), 8, onError);

      expect(file.enabled).toBe(false);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(() => file.write('one\n')).not.toThrow();
    });
  });

  describe('installBackendLogFile', () => {
    let uninstall: (() => void) | null = null;
    afterEach(() => uninstall?.());

    it('does nothing without a folder', () => {
      expect(installBackendLogFile(undefined)).toBeNull();
    });

    it('copies stdout and stderr to backend.log', () => {
      const out = jest
        .spyOn(process.stdout, 'write')
        .mockImplementation(() => true);
      const err = jest
        .spyOn(process.stderr, 'write')
        .mockImplementation(() => true);
      uninstall = installBackendLogFile(dir);

      process.stdout.write('to stdout\n');
      process.stderr.write('to stderr\n');
      uninstall!();
      uninstall = null;
      // Still printed, not only copied
      expect(out).toHaveBeenCalledWith('to stdout\n');
      out.mockRestore();
      err.mockRestore();

      expect(read(BACKEND_LOG_FILE)).toBe('to stdout\nto stderr\n');
    });

    it('writes the stack of an uncaught exception', () => {
      uninstall = installBackendLogFile(dir);

      // What Node does right before it prints a fatal exception
      process
        .listeners('uncaughtExceptionMonitor')
        .forEach((listener) =>
          listener(new Error('it broke'), 'uncaughtException'),
        );

      expect(read(BACKEND_LOG_FILE)).toMatch(
        /FATAL uncaughtException: Error: it broke\n\s+at /,
      );
    });

    it('carries on without a file when the folder is not writable', () => {
      chmodSync(dir, 0o500);
      const err = jest
        .spyOn(process.stderr, 'write')
        .mockImplementation(() => true);

      uninstall = installBackendLogFile(dir);

      expect(uninstall).toBeNull();
      expect(err).toHaveBeenCalledWith(
        expect.stringContaining('Not writing the backend log'),
      );
      err.mockRestore();
    });
  });
});
