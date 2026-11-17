import { promises as fs } from 'fs';

/** Lines a client gets when it starts watching a log (SPEC-009) */
export const SNAPSHOT_LINES = 500;
/** How far back from the end the snapshot reads, so big files cost the same */
export const SNAPSHOT_BYTES = 256 * 1024;
/** Lines in one batch of new lines; older ones in the batch are skipped */
export const MAX_BATCH_LINES = 1000;
/** How much one poll reads at most; a bigger jump starts near the end */
export const MAX_POLL_BYTES = 4 * 1024 * 1024;

const NEWLINE = 0x0a;

/** The folder in `dir`, or null when it's unset or missing */
export const readableDir = async (
  dir: string | undefined,
): Promise<string | null> => {
  if (!dir) return null;
  try {
    return (await fs.stat(dir)).isDirectory() ? dir : null;
  } catch {
    return null;
  }
};

/** Where a file stood when it was last read */
export interface FilePosition {
  /** Bytes up to and including the last complete line read */
  offset: number;
  /** Null while the file doesn't exist */
  ino: number | null;
}

export interface Tail extends FilePosition {
  lines: string[];
  /** There is older history in the file than these lines */
  truncated: boolean;
}

const statOrNull = async (file: string) => {
  try {
    return await fs.stat(file);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
};

const readRange = async (file: string, start: number, end: number) => {
  const handle = await fs.open(file, 'r');
  try {
    const buffer = Buffer.alloc(end - start);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, start);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
};

/**
 * Complete lines in a chunk read from `start`. A chunk that doesn't start at
 * the beginning of the file may begin mid-line, so `skipFirst` drops up to the
 * first newline. A trailing line without its newline yet is left for later.
 */
const completeLines = (chunk: Buffer, start: number, skipFirst: boolean) => {
  const lastNewline = chunk.lastIndexOf(NEWLINE);
  if (lastNewline === -1) return { lines: [] as string[], offset: start };
  const from = skipFirst ? chunk.indexOf(NEWLINE) + 1 : 0;
  const body = chunk.subarray(from, lastNewline).toString('utf8');
  return {
    lines: from > lastNewline ? [] : body.split('\n'),
    offset: start + lastNewline + 1,
  };
};

/**
 * The last complete lines of a file, read from at most its last
 * SNAPSHOT_BYTES. `endAt` reads only up to that offset, so a second watcher
 * gets the same lines the first one's follower has already passed.
 */
export const readTail = async (
  file: string,
  endAt?: number,
  maxLines = SNAPSHOT_LINES,
  maxBytes = SNAPSHOT_BYTES,
): Promise<Tail> => {
  const stat = await statOrNull(file);
  if (!stat) return { lines: [], truncated: false, offset: 0, ino: null };

  const end = Math.min(endAt ?? stat.size, stat.size);
  const start = Math.max(0, end - maxBytes);
  const chunk = await readRange(file, start, end);
  const { lines, offset } = completeLines(chunk, start, start > 0);
  return {
    lines: lines.slice(-maxLines),
    truncated: start > 0 || lines.length > maxLines,
    // Without a single newline in the window, follow from its end
    offset: offset === start && start > 0 ? end : offset,
    ino: stat.ino,
  };
};

export type PollResult =
  | { kind: 'none' }
  | { kind: 'lines'; lines: string[]; skipped: number; position: FilePosition }
  /** The file was replaced, emptied or removed: start again from a snapshot */
  | { kind: 'reset' };

/** New complete lines written since `position` */
export const pollFile = async (
  file: string,
  position: FilePosition,
): Promise<PollResult> => {
  const stat = await statOrNull(file);
  if (!stat)
    return position.ino === null ? { kind: 'none' } : { kind: 'reset' };
  if (position.ino !== null && stat.ino !== position.ino) {
    return { kind: 'reset' };
  }
  if (stat.size < position.offset) return { kind: 'reset' };
  if (stat.size === position.offset) {
    return position.ino === null
      ? {
          kind: 'lines',
          lines: [],
          skipped: 0,
          position: { ...position, ino: stat.ino },
        }
      : { kind: 'none' };
  }

  // A jump bigger than one poll should ever see: read only its end
  const jumped = stat.size - position.offset > MAX_POLL_BYTES;
  const start = jumped ? stat.size - MAX_POLL_BYTES : position.offset;
  const chunk = await readRange(file, start, stat.size);
  const { lines, offset } = completeLines(chunk, start, jumped);
  const kept = lines.slice(-MAX_BATCH_LINES);
  return {
    kind: 'lines',
    lines: kept,
    skipped: lines.length - kept.length,
    position: { offset, ino: stat.ino },
  };
};

/** The file's size now, so a download can stop there; null when it's missing */
export const fileSize = async (file: string) =>
  (await statOrNull(file))?.size ?? null;
