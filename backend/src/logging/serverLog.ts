import * as path from 'path';

import { BACKEND_LOG_FILE } from './backendLogFile';
import { readableDir } from './logFile';

/** The server logs admins can read in the panel (SPEC-011) */
export const SERVER_LOG_SOURCES = ['backend', 'connector', 'unix'] as const;
export type ServerLogSource = (typeof SERVER_LOG_SOURCES)[number];

export const isServerLogSource = (value: unknown): value is ServerLogSource =>
  SERVER_LOG_SOURCES.includes(value as ServerLogSource);

const FILES: Record<ServerLogSource, { dirEnv: string; name: string }> = {
  backend: { dirEnv: 'BACKEND_LOGS_DIR', name: BACKEND_LOG_FILE },
  // Both written by the connector, next to the device logs
  connector: { dirEnv: 'DEVICE_LOGS_DIR', name: 'connector.log' },
  unix: { dirEnv: 'DEVICE_LOGS_DIR', name: 'unix.log' },
};

/** The source's file, or null when the backend can't see its folder */
export const serverLogPath = async (source: ServerLogSource) => {
  const { dirEnv, name } = FILES[source];
  const dir = await readableDir(process.env[dirEnv]);
  return dir ? path.join(dir, name) : null;
};

export const serverLogDownloadName = (source: ServerLogSource, now: Date) =>
  `${source}-${now.toISOString().slice(0, 10)}.log`;
