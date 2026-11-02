import { BadGatewayException, GatewayTimeoutException } from '@nestjs/common';
import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';

import { StationTesterService } from './station-tester.service';

describe('StationTesterService', () => {
  const socketPath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'station-tester-')),
    'socket.sock',
  );
  const previousSocketPath = process.env.SOCKET_PATH;
  let server: net.Server;
  let service: StationTesterService;

  /** Serves the socket, handing every received packet to onPacket */
  const serve = (
    onPacket: (packet: { tag: number }, socket: net.Socket) => void,
  ) =>
    new Promise<void>((resolve) => {
      server = net.createServer((socket) => {
        socket.on('error', () => {});
        socket.on('data', (data) =>
          onPacket(JSON.parse(data.toString().replace('\0', '')), socket),
        );
      });
      server.listen(socketPath, resolve);
    });

  beforeEach(() => {
    process.env.SOCKET_PATH = socketPath;
    service = new StationTesterService();
  });

  afterEach(async () => {
    if (server?.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  afterAll(() => {
    process.env.SOCKET_PATH = previousSocketPath;
  });

  it('skips broadcasts and answers with the reply carrying its tag', async () => {
    await serve((packet, socket) => {
      socket.write(JSON.stringify({ type: 'ServerStatus', data: {} }) + '\0');
      socket.write('not json\0');
      socket.write(JSON.stringify({ type: 'Other', tag: 0, data: {} }) + '\0');
      socket.write(
        JSON.stringify({ type: 'PongResp', tag: packet.tag, data: { ok: 1 } }) +
          '\0',
      );
    });

    const { sent, reply } = await service.send({ type: 'Ping', data: {} });

    expect(reply).toEqual({ type: 'PongResp', tag: sent.tag, data: { ok: 1 } });
  });

  it('reads a reply split across several chunks', async () => {
    await serve((packet, socket) => {
      const reply =
        JSON.stringify({ type: 'PongResp', tag: packet.tag }) + '\0';
      socket.write(reply.slice(0, 5));
      setTimeout(() => socket.write(reply.slice(5)), 10);
    });

    const { sent, reply } = await service.send({ type: 'Ping', data: {} });

    expect(reply.tag).toBe(sent.tag);
  });

  it('gives up when no reply comes', async () => {
    await serve(() => {});
    service.replyTimeoutMs = 20;

    await expect(service.send({ type: 'Ping', data: {} })).rejects.toThrow(
      GatewayTimeoutException,
    );
  });

  it('reports a socket that cannot be reached', async () => {
    await expect(service.send({ type: 'Ping', data: {} })).rejects.toThrow(
      BadGatewayException,
    );
  });
});
