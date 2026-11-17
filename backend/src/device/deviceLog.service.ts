import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  ServiceUnavailableException,
  StreamableFile,
} from '@nestjs/common';
import { DbService } from 'src/db/db.service';

import { logFileDownload } from '../logging/logDownload';
import { LogFollowers } from '../logging/logFollowers';
import { deviceLogPath, deviceLogsDir, downloadFileName } from './deviceLog';

/** Sent to a client when it starts watching, and to the room after a reset */
export interface DeviceLogSnapshot {
  deviceId: string;
  /** False when the backend can't see the connector's logs folder */
  available: boolean;
  lines: string[];
  /** There is older history in the file than these lines */
  truncated: boolean;
}

/** New lines since the last event */
export interface DeviceLogLines {
  deviceId: string;
  lines: string[];
  /** Lines left out because the batch was capped */
  skipped: number;
}

export interface DeviceLogListener {
  /** Whether anyone still watches; checked on every poll */
  hasWatchers: () => boolean;
  onLines: (event: DeviceLogLines) => void;
  onSnapshot: (event: DeviceLogSnapshot) => void;
}

const emptySnapshot = (
  deviceId: string,
  available: boolean,
): DeviceLogSnapshot => ({ deviceId, available, lines: [], truncated: false });

/**
 * Reads the per-device log files the connector writes, for admins to watch
 * live and download (SPEC-009). Nothing is stored; one follower per watched
 * device polls its file while anyone watches.
 */
@Injectable()
export class DeviceLogService implements OnModuleDestroy {
  private followers = new LogFollowers(new Logger(DeviceLogService.name));

  constructor(private readonly prisma: DbService) {}

  onModuleDestroy() {
    this.followers.stopAll();
  }

  private async logFile(deviceId: string) {
    const dir = await deviceLogsDir();
    if (!dir) return { available: false, file: null };
    if (typeof deviceId !== 'string') return { available: true, file: null };
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { espId: true, name: true },
    });
    if (device?.espId == null) return { available: true, file: null };
    return {
      available: true,
      file: deviceLogPath(dir, device.espId),
      name: device.name,
    };
  }

  /**
   * The recent lines for a new watcher, and a follower that keeps the room
   * up to date. A device that already has a follower keeps it, and the
   * snapshot ends where that follower is, so nothing arrives twice.
   */
  async watch(
    deviceId: string,
    listener: DeviceLogListener,
  ): Promise<DeviceLogSnapshot> {
    const { available, file } = await this.logFile(deviceId);
    if (!file) return emptySnapshot(deviceId, available);

    const snapshot = await this.followers.watch(deviceId, file, {
      hasWatchers: listener.hasWatchers,
      onLines: (event) => listener.onLines({ deviceId, ...event }),
      onSnapshot: (event) =>
        listener.onSnapshot({ deviceId, available: true, ...event }),
    });
    return { deviceId, available, ...snapshot };
  }

  /** Stops following a device once nobody watches it */
  release(deviceId: string) {
    this.followers.release(deviceId);
  }

  isFollowing(deviceId: string) {
    return this.followers.isFollowing(deviceId);
  }

  /** Runs one poll right away, so tests don't wait for the interval */
  pollNow(deviceId: string) {
    return this.followers.pollNow(deviceId);
  }

  /** The whole file as it is now, for downloading */
  async download(deviceId: string, now = new Date()): Promise<StreamableFile> {
    const target = await this.logFile(deviceId);
    if (!target.available) {
      throw new ServiceUnavailableException(
        "Device logs aren't available on this server",
      );
    }
    const download = target.file
      ? await logFileDownload(
          target.file,
          downloadFileName(target.name ?? '', now),
        )
      : null;
    if (!download) throw new NotFoundException('No logs from this device yet');
    return download;
  }
}
