import { Logger } from '@nestjs/common';
import * as net from 'net';

import { INIT_DATA_RETRY_BASE_MS, SocketServer } from './socket.server';
import { SocketService } from './socket.service';

jest.mock('../wasm/hil_processor_wasm.js', () => ({}));

describe('SocketServer', () => {
  describe('sendInitDataWithRetry', () => {
    const serverStatus = {
      devices: [{ espId: 101, type: 'STATION', signKey: 4242 }],
      wifiSsid: 'example-wifi',
    };

    let socket: { destroyed: boolean; write: jest.Mock };
    let getServerStatus: jest.Mock;
    let server: SocketServer;
    let unhandled: jest.Mock;

    beforeEach(() => {
      jest.useFakeTimers();
      jest.spyOn(Logger.prototype, 'log').mockImplementation();
      jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      jest.spyOn(Logger.prototype, 'error').mockImplementation();
      unhandled = jest.fn();
      process.on('unhandledRejection', unhandled);

      socket = { destroyed: false, write: jest.fn() };
      getServerStatus = jest.fn();
      server = new SocketServer('/tmp/unused.sock', {
        getServerStatus,
      } as unknown as SocketService);
    });

    afterEach(() => {
      process.off('unhandledRejection', unhandled);
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    // Gives Node the chance to report a rejection nobody handled
    const flushUnhandled = async () => {
      jest.useRealTimers();
      await new Promise((resolve) => setImmediate(resolve));
    };

    it('sends the init data after the database comes back', async () => {
      getServerStatus
        .mockRejectedValueOnce(new Error("Can't reach database server"))
        .mockResolvedValueOnce(serverStatus);

      const sent = server.sendInitDataWithRetry(
        socket as unknown as net.Socket,
      );
      await jest.advanceTimersByTimeAsync(INIT_DATA_RETRY_BASE_MS);
      await sent;
      await flushUnhandled();

      expect(getServerStatus).toHaveBeenCalledTimes(2);
      expect(socket.write).toHaveBeenCalledTimes(1);
      expect(socket.write).toHaveBeenCalledWith(
        JSON.stringify({ type: 'ServerStatus', data: serverStatus }) + '\0',
      );
      expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
      expect(unhandled).not.toHaveBeenCalled();
    });

    it('waits longer after each failure', async () => {
      getServerStatus
        .mockRejectedValueOnce(new Error("Can't reach database server"))
        .mockRejectedValueOnce(new Error("Can't reach database server"))
        .mockResolvedValueOnce(serverStatus);

      const sent = server.sendInitDataWithRetry(
        socket as unknown as net.Socket,
      );
      await jest.advanceTimersByTimeAsync(INIT_DATA_RETRY_BASE_MS);
      expect(getServerStatus).toHaveBeenCalledTimes(2);
      await jest.advanceTimersByTimeAsync(INIT_DATA_RETRY_BASE_MS);
      expect(socket.write).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(INIT_DATA_RETRY_BASE_MS);
      await sent;

      expect(getServerStatus).toHaveBeenCalledTimes(3);
      expect(socket.write).toHaveBeenCalledTimes(1);
    });

    it('stops trying once the connector disconnects', async () => {
      getServerStatus.mockRejectedValue(
        new Error("Can't reach database server"),
      );

      const sent = server.sendInitDataWithRetry(
        socket as unknown as net.Socket,
      );
      await jest.advanceTimersByTimeAsync(0);
      socket.destroyed = true;
      await jest.advanceTimersByTimeAsync(INIT_DATA_RETRY_BASE_MS);
      await sent;
      await flushUnhandled();

      expect(getServerStatus).toHaveBeenCalledTimes(1);
      expect(socket.write).not.toHaveBeenCalled();
      expect(unhandled).not.toHaveBeenCalled();
    });
  });
});
