import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  ServiceUnavailableException,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream } from 'fs';
import { DbService } from 'src/db/db.service';

import {
  deviceLogPath,
  deviceLogsDir,
  downloadFileName,
  FilePosition,
  fileSize,
  pollFile,
  readTail,
} from './deviceLog';

/** How often a watched log file is checked for new lines */
export const POLL_INTERVAL_MS = 1000;

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

interface Follower {
  file: string;
  position: FilePosition;
  timer: NodeJS.Timeout;
  polling: boolean;
  listener: DeviceLogListener;
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
  private followers = new Map<string, Follower>();
  private logger = new Logger(DeviceLogService.name);

  constructor(private readonly prisma: DbService) {}

  onModuleDestroy() {
    this.followers.forEach((follower) => clearInterval(follower.timer));
    this.followers.clear();
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

    const joinExisting = async (existing: Follower) => {
      existing.listener = listener;
      const tail = await readTail(file, existing.position.offset);
      return {
        deviceId,
        available,
        lines: tail.lines,
        truncated: tail.truncated,
      };
    };
    const existing = this.followers.get(deviceId);
    if (existing && existing.file === file) return joinExisting(existing);
    // The device was re-registered under another esp id
    if (existing) this.stop(deviceId);

    const tail = await readTail(file);
    // Another admin may have started one while this read
    const started = this.followers.get(deviceId);
    if (started) return joinExisting(started);
    const follower: Follower = {
      file,
      position: { offset: tail.offset, ino: tail.ino },
      polling: false,
      listener,
      timer: setInterval(() => void this.poll(deviceId), POLL_INTERVAL_MS),
    };
    this.followers.set(deviceId, follower);
    return {
      deviceId,
      available,
      lines: tail.lines,
      truncated: tail.truncated,
    };
  }

  /** Stops following a device once nobody watches it */
  release(deviceId: string) {
    const follower = this.followers.get(deviceId);
    if (follower && !follower.listener.hasWatchers()) this.stop(deviceId);
  }

  isFollowing(deviceId: string) {
    return this.followers.has(deviceId);
  }

  private stop(deviceId: string) {
    const follower = this.followers.get(deviceId);
    if (!follower) return;
    clearInterval(follower.timer);
    this.followers.delete(deviceId);
  }

  /** One check of a followed file */
  private async poll(deviceId: string) {
    const follower = this.followers.get(deviceId);
    if (!follower || follower.polling) return;
    // A watcher that closed the tab leaves the room without a leave event
    if (!follower.listener.hasWatchers()) {
      this.stop(deviceId);
      return;
    }
    follower.polling = true;
    try {
      const result = await pollFile(follower.file, follower.position);
      if (result.kind === 'lines') {
        follower.position = result.position;
        if (result.lines.length || result.skipped) {
          follower.listener.onLines({
            deviceId,
            lines: result.lines,
            skipped: result.skipped,
          });
        }
      } else if (result.kind === 'reset') {
        const tail = await readTail(follower.file);
        follower.position = { offset: tail.offset, ino: tail.ino };
        follower.listener.onSnapshot({
          deviceId,
          available: true,
          lines: tail.lines,
          truncated: tail.truncated,
        });
      }
    } catch (e) {
      this.logger.warn(
        `Cannot read the log of device ${deviceId}: ${e instanceof Error ? e.message : e}`,
      );
    } finally {
      follower.polling = false;
    }
  }

  /** Runs one poll right away, so tests don't wait for the interval */
  pollNow(deviceId: string) {
    return this.poll(deviceId);
  }

  /** The whole file as it is now, for downloading */
  async download(deviceId: string, now = new Date()): Promise<StreamableFile> {
    const target = await this.logFile(deviceId);
    if (!target.available) {
      throw new ServiceUnavailableException(
        "Device logs aren't available on this server",
      );
    }
    const size = target.file ? await fileSize(target.file) : null;
    if (!target.file || size === null) {
      throw new NotFoundException('No logs from this device yet');
    }

    const options = {
      type: 'text/plain; charset=utf-8',
      disposition: `attachment; filename="${downloadFileName(target.name ?? '', now)}"`,
      length: size,
    };
    // Up to the size it had now, so lines written meanwhile can't cut it mid-line
    return size === 0
      ? new StreamableFile(Buffer.alloc(0), options)
      : new StreamableFile(
          createReadStream(target.file, { start: 0, end: size - 1 }),
          options,
        );
  }
}
