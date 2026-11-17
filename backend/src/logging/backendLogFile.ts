import * as fs from 'fs';
import * as path from 'path';

/** A log file is rotated to `<file>.1` once it would pass this size */
export const MAX_LOG_FILE_BYTES = 10 * 1024 * 1024;

export const BACKEND_LOG_FILE = 'backend.log';

/**
 * An append-only file that starts again once it would pass `maxBytes`,
 * keeping the previous one as `<file>.1`. Writes are synchronous so a crash
 * can't lose the last lines, and a write error turns it off for good rather
 * than reaching the caller: logging to a file must never stop the backend.
 */
export class CappedLogFile {
  private fd: number | null = null;
  private size = 0;

  constructor(
    private readonly file: string,
    private readonly maxBytes = MAX_LOG_FILE_BYTES,
    private readonly onError: (e: unknown) => void = () => {},
  ) {
    this.guard(() => this.open());
  }

  get enabled() {
    return this.fd !== null;
  }

  write(chunk: string | Uint8Array) {
    if (this.fd === null) return;
    const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    if (!bytes.length) return;
    this.guard(() => {
      if (this.size > 0 && this.size + bytes.length > this.maxBytes) {
        this.rotate();
      }
      fs.writeSync(this.fd!, bytes);
      this.size += bytes.length;
    });
  }

  close() {
    if (this.fd === null) return;
    const fd = this.fd;
    this.fd = null;
    try {
      fs.closeSync(fd);
    } catch {
      // Already gone; nothing left to flush
    }
  }

  private open() {
    this.fd = fs.openSync(this.file, 'a');
    this.size = fs.fstatSync(this.fd).size;
  }

  private rotate() {
    fs.closeSync(this.fd!);
    this.fd = null;
    fs.renameSync(this.file, `${this.file}.1`);
    this.open();
  }

  private guard(action: () => void) {
    try {
      action();
    } catch (e) {
      this.close();
      this.onError(e);
    }
  }
}

type Write = typeof process.stdout.write;

const tee = (stream: NodeJS.WriteStream, file: CappedLogFile) => {
  const original = stream.write;
  stream.write = function (
    this: NodeJS.WriteStream,
    chunk: string | Uint8Array,
    ...rest: unknown[]
  ) {
    const encoding = typeof rest[0] === 'string' ? rest[0] : undefined;
    file.write(
      typeof chunk === 'string' && encoding
        ? Buffer.from(chunk, encoding as BufferEncoding)
        : chunk,
    );
    return (original as (...args: unknown[]) => boolean).call(
      this,
      chunk,
      ...rest,
    );
  } as Write;
  return () => {
    stream.write = original;
  };
};

/**
 * Copies everything the backend prints to `backend.log` in `dir`, so admins
 * can read it in the panel (SPEC-011). Call it before anything else logs.
 * Returns a function that stops copying, or null when there's no `dir`.
 */
export const installBackendLogFile = (
  dir: string | undefined,
  maxBytes = MAX_LOG_FILE_BYTES,
) => {
  if (!dir) return null;
  // Reported straight to the console, past the copy that just failed
  const stderrWrite = process.stderr.write.bind(process.stderr);
  const file = new CappedLogFile(
    path.join(dir, BACKEND_LOG_FILE),
    maxBytes,
    (e) =>
      stderrWrite(
        `Not writing the backend log to ${dir} any more: ${e instanceof Error ? e.message : e}\n`,
      ),
  );
  if (!file.enabled) return null;

  const restoreStdout = tee(process.stdout, file);
  const restoreStderr = tee(process.stderr, file);
  // Node prints a fatal exception from native code, past process.stderr
  const onFatal = (error: Error, origin: string) =>
    file.write(
      `${new Date().toISOString()} FATAL ${origin}: ${error?.stack ?? error}\n`,
    );
  process.on('uncaughtExceptionMonitor', onFatal);

  return () => {
    process.off('uncaughtExceptionMonitor', onFatal);
    restoreStderr();
    restoreStdout();
    file.close();
  };
};
