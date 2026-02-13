import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as net from 'net';

import * as wasm from '../wasm/hil_processor_wasm.js';
import { RequestDto } from './dto/request.dto';
import { ResponseDto } from './dto/response.dto';
import { SocketService } from './socket.service';

export class SocketServer {
  private server: net.Server;
  private logger = new Logger('socket-server');
  private connectedSockets: net.Socket[] = [];

  hilRunning: boolean = false;
  private hilProcessor: any;
  private hilInterval: any | null = null;

  constructor(
    private readonly path: string,
    private readonly socketService: SocketService,
  ) {
    this.server = net.createServer();
  }

  start(callback: () => void) {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    if (fs.existsSync(this.path)) {
      fs.unlinkSync(this.path);
    }

    this.server.listen(this.path, () => {
      fs.chmodSync(this.path, '777');
      this.logger.log('Unix socket server started at ' + this.path);
      callback();
    });

    this.server.on('connection', async (socket) => {
      let buffer = Buffer.alloc(0);

      this.logger.log('Client connected');
      this.connectedSockets.push(socket);
      await this.sendInitData(socket);
      socket.on('data', async (data) => {
        buffer = Buffer.concat([buffer, Buffer.from(data)]);

        let nullIdx = buffer.indexOf(0x00);
        while (nullIdx !== -1) {
          const packet = buffer.subarray(0, nullIdx);

          if (this.hilRunning) {
            this.hilProcessor.feed_packet(packet.toString());
          } else {
            const request: RequestDto<any> = JSON.parse(packet.toString());
            this.parsePacket(socket, request);
          }

          buffer = buffer.subarray(nullIdx + 1);
          nullIdx = buffer.indexOf(0x00);
        }
      });
    });
  }

  stop(callback: () => void) {
    this.server.close(() => {
      this.logger.log('Unix socket server stopped');
      callback();
    });
  }

  private sendResponseWithTag<T>(socket: net.Socket, request: RequestDto<T>) {
    if (this.hilRunning) return;

    // Skip logging for UpdateBatteryPercentage to reduce log spam
    if (request.type !== 'UpdateBatteryPercentage') {
      this.logger.log(
        `Sending response of type ${request.type} to socket, tag ${request.tag}, data ${JSON.stringify(request.data)}`,
      );
    }
    socket.write(JSON.stringify(this.parseResponse(request)) + '\0');
  }

  private sendResponse<T>(socket: net.Socket, response: ResponseDto<T>) {
    if (this.hilRunning) return;

    this.logger.log(
      `Sending response of type ${response.type} to socket, data ${JSON.stringify(response.data)}`,
    );
    socket.write(JSON.stringify(response) + '\0');
  }

  sendToAll<T>(response: ResponseDto<T>) {
    if (this.hilRunning) return;

    this.logger.log(`Sending ${response.type} to all connected sockets`);
    this.connectedSockets.forEach((socket) => {
      socket.write(JSON.stringify(response) + '\0');
    });
  }

  async sendInitData(socket: net.Socket) {
    if (this.hilRunning) return;

    this.logger.log('Sending init data to socket');
    const serverStatus = await this.socketService.getServerStatus();
    this.sendResponse(socket, {
      type: 'ServerStatus',
      data: serverStatus,
    });
  }

  async sendServerStatus() {
    const serverStatus = await this.socketService.getServerStatus();
    if (this.hilRunning) {
      this.hilProcessor.set_status(JSON.stringify(serverStatus));
    }

    this.sendToAll({
      type: 'ServerStatus',
      data: serverStatus,
    });
  }

  async sendAutoSetupStatus() {
    const autoSetupStatus = await this.socketService.getAutoSetupSettings();
    this.sendToAll({
      type: 'AutoSetupSettings',
      data: autoSetupStatus,
    });
  }

  async sendFirmware(fileName: string, fileData: string) {
    this.sendToAll({
      type: 'UploadFirmware',
      data: {
        fileName,
        fileData,
      },
    });
  }

  async toggleHil(state: boolean) {
    this.logger.log('HIL testing state change: ' + state);
    if (this.hilInterval != null) clearInterval(this.hilInterval);

    if (state) {
      const status = await this.socketService.getServerStatus();
      this.hilProcessor = wasm.init((tag, msg) => {
        this.logger.log(`[${tag}] ${msg}`);
      }, JSON.stringify(status));

      this.hilRunning = true;
      this.hilInterval = setInterval(() => {
        const res = this.hilProcessor.generate_output();
        if (res.length > 0) {
          this.connectedSockets.forEach((cs) => {
            cs.write(res);
          });
        }
      }, 50);
    } else {
      this.hilRunning = false;
    }
  }

  private async parsePacket(socket: net.Socket, request: RequestDto<any>) {
    // Skip logging for UpdateBatteryPercentage to reduce log spam
    if (request.type !== 'UpdateBatteryPercentage') {
      this.logger.log(
        `Received request of type ${request.type}, tag ${request.tag}, data ${JSON.stringify(request.data)}`,
      );
    }
    if (request.type === 'EnterAttempt') {
      const responseData = await this.socketService.enterAttempt(request.data);
      this.sendResponseWithTag(socket, {
        type: 'EnterAttempt',
        tag: request.tag,
        data: responseData,
      });
    } else if (request.type === 'RequestToConnectDevice') {
      const responseData = await this.socketService.requestToConnectDevice(
        request.data,
      );
      this.sendResponseWithTag(socket, {
        type: 'RequestToConnectDevice',
        tag: request.tag,
        data: responseData,
      });
    } else if (request.type === 'UpdateBatteryPercentage') {
      const responseData = await this.socketService.updateBatteryPercentage(
        request.data,
      );
      this.sendResponseWithTag(socket, {
        type: 'UpdateBatteryPercentage',
        tag: request.tag,
        data: responseData,
      });
    } else if (request.type === 'CreateAttendance') {
      const responseData = await this.socketService.createAttendance(
        request.data,
      );
      this.sendResponseWithTag(socket, {
        type: 'CreateAttendance',
        tag: request.tag,
        data: responseData,
      });
    } else if (request.type === 'ServerStatus') {
      const responseData = await this.socketService.getServerStatus();
      this.sendResponseWithTag(socket, {
        type: 'ServerStatus',
        tag: request.tag,
        data: responseData,
      });
    } else if (request.type === 'AutoSetupSettings') {
      const responseData = await this.socketService.getAutoSetupSettings();
      this.sendResponseWithTag(socket, {
        type: 'AutoSetupSettings',
        tag: request.tag,
        data: responseData,
      });
    } else if (request.type === 'PersonInfo') {
      const responseData = await this.socketService.getPersonInfo(
        request.data.cardId,
        request.data.espId,
        request.data.isCompetitor,
      );
      this.sendResponseWithTag(socket, {
        type: 'PersonInfo',
        tag: request.tag,
        data: responseData,
      });
    } else if (request.type === 'CheckTimeEntry') {
      const responseData = await this.socketService.checkIfAttemptEntered(
        request.data,
      );
      this.sendResponseWithTag(socket, {
        type: 'CheckTimeEntry',
        tag: request.tag,
        data: responseData,
      });
    } else {
      this.logger.error('Unknown request type');
    }
  }

  private parseResponse(response: RequestDto<any>) {
    return {
      type: response.data.error ? 'Error' : response.type + 'Resp',
      data: response.data,
      tag: response.tag,
      error: response.data.error,
    };
  }
}
