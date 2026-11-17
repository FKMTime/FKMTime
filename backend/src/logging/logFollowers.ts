import { Logger } from '@nestjs/common';

import { FilePosition, pollFile, readTail } from './logFile';

/** How often a watched log file is checked for new lines */
export const POLL_INTERVAL_MS = 1000;

export interface TailSnapshot {
  lines: string[];
  /** There is older history in the file than these lines */
  truncated: boolean;
}

export interface TailLines {
  lines: string[];
  /** Lines left out because the batch was capped */
  skipped: number;
}

export interface TailListener {
  /** Whether anyone still watches; checked on every poll */
  hasWatchers: () => boolean;
  onLines: (event: TailLines) => void;
  onSnapshot: (event: TailSnapshot) => void;
}

interface Follower {
  file: string;
  position: FilePosition;
  timer: NodeJS.Timeout;
  polling: boolean;
  listener: TailListener;
}

/**
 * Follows log files while anyone watches them (SPEC-009, SPEC-011): one
 * follower per key polls its file and passes complete new lines on. Nothing
 * is stored.
 */
export class LogFollowers {
  private followers = new Map<string, Follower>();

  constructor(private readonly logger: Logger) {}

  stopAll() {
    this.followers.forEach((follower) => clearInterval(follower.timer));
    this.followers.clear();
  }

  /**
   * The recent lines for a new watcher, and a follower that keeps the
   * listener up to date. A key that already has a follower keeps it, and the
   * snapshot ends where that follower is, so nothing arrives twice.
   */
  async watch(
    key: string,
    file: string,
    listener: TailListener,
  ): Promise<TailSnapshot> {
    const joinExisting = async (existing: Follower) => {
      existing.listener = listener;
      const tail = await readTail(file, existing.position.offset);
      return { lines: tail.lines, truncated: tail.truncated };
    };
    const existing = this.followers.get(key);
    if (existing && existing.file === file) return joinExisting(existing);
    // The key now points at another file (a re-registered device)
    if (existing) this.stop(key);

    const tail = await readTail(file);
    // Another watcher may have started one while this read
    const started = this.followers.get(key);
    if (started) return joinExisting(started);
    this.followers.set(key, {
      file,
      position: { offset: tail.offset, ino: tail.ino },
      polling: false,
      listener,
      timer: setInterval(() => void this.poll(key), POLL_INTERVAL_MS),
    });
    return { lines: tail.lines, truncated: tail.truncated };
  }

  /** Stops following once nobody watches */
  release(key: string) {
    const follower = this.followers.get(key);
    if (follower && !follower.listener.hasWatchers()) this.stop(key);
  }

  isFollowing(key: string) {
    return this.followers.has(key);
  }

  /** Runs one poll right away, so tests don't wait for the interval */
  pollNow(key: string) {
    return this.poll(key);
  }

  private stop(key: string) {
    const follower = this.followers.get(key);
    if (!follower) return;
    clearInterval(follower.timer);
    this.followers.delete(key);
  }

  /** One check of a followed file */
  private async poll(key: string) {
    const follower = this.followers.get(key);
    if (!follower || follower.polling) return;
    // A watcher that closed the tab leaves the room without a leave event
    if (!follower.listener.hasWatchers()) {
      this.stop(key);
      return;
    }
    follower.polling = true;
    try {
      const result = await pollFile(follower.file, follower.position);
      if (result.kind === 'lines') {
        follower.position = result.position;
        if (result.lines.length || result.skipped) {
          follower.listener.onLines({
            lines: result.lines,
            skipped: result.skipped,
          });
        }
      } else if (result.kind === 'reset') {
        const tail = await readTail(follower.file);
        follower.position = { offset: tail.offset, ino: tail.ino };
        follower.listener.onSnapshot({
          lines: tail.lines,
          truncated: tail.truncated,
        });
      }
    } catch (e) {
      this.logger.warn(
        `Cannot read ${follower.file}: ${e instanceof Error ? e.message : e}`,
      );
    } finally {
      follower.polling = false;
    }
  }
}
