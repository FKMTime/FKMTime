import { INestApplication } from '@nestjs/common';
import { AddressInfo } from 'net';
import { io, Socket } from 'socket.io-client';
import { AppGateway } from 'src/app.gateway';

/** Starts the HTTP + socket.io server on a random free port */
export const listenOnRandomPort = async (
  app: INestApplication,
): Promise<string> => {
  await app.listen(0);
  const address = app.getHttpServer().address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
};

/** Connects like the frontend does: websocket transport, JWT in auth.token */
export const connectSocketIo = async (
  url: string,
  token?: string,
  timeoutMs = 5000,
): Promise<Socket> => {
  const socket = io(url, {
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
    auth: token ? { token } : {},
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('Timed out connecting to socket.io'));
    }, timeoutMs);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once('connect_error', (err) => {
      clearTimeout(timer);
      socket.close();
      reject(err);
    });
  });
  return socket;
};

/** Resolves with the payload of the next matching event */
export const waitForEvent = <T = any>(
  socket: Socket,
  event: string,
  predicate: (payload: T) => boolean = () => true,
  timeoutMs = 5000,
): Promise<T> =>
  new Promise((resolve, reject) => {
    const handler = (payload: T) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for socket.io event "${event}"`));
    }, timeoutMs);
    socket.on(event, handler);
  });

/** Records every payload of an event, for asserting what was (not) received */
export const recordEvents = <T = any>(socket: Socket, event: string) => {
  const received: T[] = [];
  const handler = (payload: T) => received.push(payload);
  socket.on(event, handler);
  return {
    received,
    stop: () => socket.off(event, handler),
  };
};

const isInRoom = async (gateway: AppGateway, room: string, id: string) => {
  const sockets = await gateway.server.in(room).fetchSockets();
  return sockets.some((s) => s.id === id);
};

/**
 * Join handlers do not acknowledge, so the only deterministic way to know a
 * join/leave has been processed is to look at the room on the server.
 */
export const waitForRoomMembership = async (
  gateway: AppGateway,
  room: string,
  socket: Socket,
  expected = true,
  timeoutMs = 5000,
) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await isInRoom(gateway, room, socket.id)) === expected) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(
    `Socket ${socket.id} ${expected ? 'never joined' : 'never left'} room "${room}"`,
  );
};

export const isSocketInRoom = (
  gateway: AppGateway,
  room: string,
  socket: Socket,
) => isInRoom(gateway, room, socket.id);

/** Emits a join message and waits until the server has put us in the room */
export const joinRoom = async (
  gateway: AppGateway,
  socket: Socket,
  message: string,
  room: string,
  payload?: unknown,
) => {
  if (payload === undefined) socket.emit(message);
  else socket.emit(message, payload);
  await waitForRoomMembership(gateway, room, socket, true);
};
