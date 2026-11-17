import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  ServiceUnavailableException,
  StreamableFile,
} from '@nestjs/common';

import { logFileDownload } from './logDownload';
import { LogFollowers } from './logFollowers';
import {
  serverLogDownloadName,
  serverLogPath,
  ServerLogSource,
} from './serverLog';

/** Sent to a client when it starts watching, and to the room after a reset */
export interface ServerLogSnapshot {
  source: ServerLogSource;
  /** False when the backend can't see the log's folder */
  available: boolean;
  lines: string[];
  /** There is older history in the file than these lines */
  truncated: boolean;
}

/** New lines since the last event */
export interface ServerLogLines {
  source: ServerLogSource;
  lines: string[];
  /** Lines left out because the batch was capped */
  skipped: number;
}

export interface ServerLogListener {
  /** Whether anyone still watches; checked on every poll */
  hasWatchers: () => boolean;
  onLines: (event: ServerLogLines) => void;
  onSnapshot: (event: ServerLogSnapshot) => void;
}

/**
 * The backend's and the connector's own logs, for admins to watch live and
 * download (SPEC-011). Followed the same way as device logs (SPEC-009).
 */
@Injectable()
export class ServerLogService implements OnModuleDestroy {
  private followers = new LogFollowers(new Logger(ServerLogService.name));

  onModuleDestroy() {
    this.followers.stopAll();
  }

  async watch(
    source: ServerLogSource,
    listener: ServerLogListener,
  ): Promise<ServerLogSnapshot> {
    const file = await serverLogPath(source);
    if (!file) return { source, available: false, lines: [], truncated: false };

    const snapshot = await this.followers.watch(source, file, {
      hasWatchers: listener.hasWatchers,
      onLines: (event) => listener.onLines({ source, ...event }),
      onSnapshot: (event) =>
        listener.onSnapshot({ source, available: true, ...event }),
    });
    return { source, available: true, ...snapshot };
  }

  /** Stops following a log once nobody watches it */
  release(source: ServerLogSource) {
    this.followers.release(source);
  }

  isFollowing(source: ServerLogSource) {
    return this.followers.isFollowing(source);
  }

  /** Runs one poll right away, so tests don't wait for the interval */
  pollNow(source: ServerLogSource) {
    return this.followers.pollNow(source);
  }

  /** The whole file as it is now, for downloading */
  async download(
    source: ServerLogSource,
    now = new Date(),
  ): Promise<StreamableFile> {
    const file = await serverLogPath(source);
    if (!file) {
      throw new ServiceUnavailableException(
        "This log isn't available on this server",
      );
    }
    const download = await logFileDownload(
      file,
      serverLogDownloadName(source, now),
    );
    if (!download) throw new NotFoundException('Nothing logged yet');
    return download;
  }
}
