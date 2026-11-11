import { INestApplication } from '@nestjs/common';
import { once } from 'events';
import * as net from 'net';
import { SocketController } from 'src/socket/socket.controller';

// Same default as SocketController, so CI (no SOCKET_PATH) and local runs
// (SOCKET_PATH pointing at a private socket) both work.
export const stationSocketPath = () =>
  process.env.SOCKET_PATH || '/tmp/socket.sock';

export interface StationMessage {
  type: string;
  data: any;
  tag?: number;
  error?: boolean;
}

/**
 * The Unix socket server refuses to start when NODE_ENV is "test", so the
 * e2e app boots without it. This re-runs SocketController.onModuleInit with
 * NODE_ENV briefly changed, which replaces the controller's (never started)
 * server with a listening one. Everything the app sends to stations through
 * SocketController (server status, incident resolved, firmware...) then goes
 * through the real server, exactly as in production.
 */
export const startStationSocketServer = async (app: INestApplication) => {
  const controller = app.get(SocketController, { strict: false });
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'e2e-station-socket';
  try {
    controller.onModuleInit();
  } finally {
    process.env.NODE_ENV = previousEnv;
  }
  const socketServer = (controller as any).socketServer;
  const server: net.Server = socketServer.server;
  if (!server.listening) {
    await once(server, 'listening');
  }
  return {
    path: stationSocketPath(),
    /** The running SocketServer, for looking at its internal state */
    socketServer,
    /** Server-side sockets, so they can be torn down before app.close() */
    destroyConnections: () => {
      (socketServer.connectedSockets as net.Socket[]).forEach((s) =>
        s.destroy(),
      );
    },
  };
};

/**
 * A fake station / micro-connector speaking the station protocol: JSON
 * packets terminated by a NUL byte. Requests carry a numeric tag that the
 * server echoes back in the response.
 */
export class StationClient {
  private buffer = Buffer.alloc(0);
  private messages: StationMessage[] = [];
  private waiters: {
    predicate: (m: StationMessage) => boolean;
    resolve: (m: StationMessage) => void;
  }[] = [];
  private nextTag = 1;

  private constructor(private readonly socket: net.Socket) {
    socket.on('data', (chunk) => this.onData(chunk));
    socket.on('error', () => {});
  }

  static async connect(path = stationSocketPath()): Promise<StationClient> {
    const socket = net.connect(path);
    await once(socket, 'connect');
    return new StationClient(socket);
  }

  private onData(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    let idx = this.buffer.indexOf(0x00);
    while (idx !== -1) {
      const packet = this.buffer.subarray(0, idx).toString();
      this.buffer = this.buffer.subarray(idx + 1);
      idx = this.buffer.indexOf(0x00);
      let message: StationMessage;
      try {
        message = JSON.parse(packet);
      } catch {
        // HIL output and anything else that is not JSON is ignored
        continue;
      }
      const waiterIdx = this.waiters.findIndex((w) => w.predicate(message));
      if (waiterIdx !== -1) {
        const [waiter] = this.waiters.splice(waiterIdx, 1);
        waiter.resolve(message);
      } else {
        this.messages.push(message);
      }
    }
  }

  /** Resolves with the first (already received or future) matching message */
  waitFor(
    predicate: (m: StationMessage) => boolean,
    timeoutMs = 5000,
    description = 'station message',
  ): Promise<StationMessage> {
    const idx = this.messages.findIndex(predicate);
    if (idx !== -1) {
      return Promise.resolve(this.messages.splice(idx, 1)[0]);
    }
    return new Promise((resolve, reject) => {
      const waiter = {
        predicate,
        resolve: (m: StationMessage) => {
          clearTimeout(timer);
          resolve(m);
        },
      };
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        reject(new Error(`Timed out waiting for ${description}`));
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }

  waitForType(type: string, timeoutMs = 5000) {
    return this.waitFor((m) => m.type === type, timeoutMs, `type ${type}`);
  }

  /** Drops every message received so far that nobody waited for */
  clear() {
    this.messages = [];
  }

  /** Messages received so far that nobody waited for */
  pending(): StationMessage[] {
    return [...this.messages];
  }

  sendRaw(payload: string) {
    this.socket.write(payload + '\0');
  }

  send(type: string, data: any): number {
    const tag = this.nextTag++;
    this.sendRaw(JSON.stringify({ type, tag, data }));
    return tag;
  }

  /** Sends a request and resolves with the response carrying the same tag */
  async request(type: string, data: any, timeoutMs = 5000) {
    const tag = this.send(type, data);
    return this.waitFor(
      (m) => m.tag === tag,
      timeoutMs,
      `response to ${type} (tag ${tag})`,
    );
  }

  close() {
    this.socket.destroy();
  }
}
