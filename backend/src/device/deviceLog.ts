import * as path from 'path';

import { readableDir } from '../logging/logFile';

/**
 * The file the connector writes a device's log to: its esp id in upper-case
 * hex without padding, e.g. `device_2806C23.log`
 */
export const deviceLogFileName = (espId: number) =>
  `device_${espId.toString(16).toUpperCase()}.log`;

/** The logs folder the backend can read, or null when it can't see one */
export const deviceLogsDir = () => readableDir(process.env.DEVICE_LOGS_DIR);

export const deviceLogPath = (dir: string, espId: number) =>
  path.join(dir, deviceLogFileName(espId));

/** A station name made safe for a Content-Disposition file name */
export const downloadFileName = (deviceName: string, now: Date) => {
  const name =
    deviceName.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') ||
    'device';
  return `${name}-${now.toISOString().slice(0, 10)}.log`;
};
