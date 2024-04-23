import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as net from 'net';
import { RequestDto } from './dto/request.dto';
import { ResponseDto } from './dto/response.dto';
import { SocketService } from './socket.service';

export class SocketServer {
  private server: net.Server;
  private logger = new Logger('socket-server');
  private connectedSockets: net.Socket[] = [];

  constructor(
    private readonly path: string,
    private readonly socketService: SocketService,
  ) {
    this.server = net.createServer();
  }

  start(callback: () => void) {
    if (fs.existsSync(this.path)) {
      fs.unlinkSync(this.path);
    }

    this.server.listen(this.path, () => {
      this.logger.log('Unix socket server started at ' + this.path);
      callback();
    });

    this.server.on('connection', async (socket) => {
      let buffer = Buffer.alloc(0);

      this.logger.log('Client connected');
      this.connectedSockets.push(socket);
      await this.sendInitData(socket);
      socket.on('data', async (data) => {
        buffer = Buffer.concat([buffer, data]);
        this.logger.log('buff length: ' + buffer.length);

        let nullIdx = buffer.indexOf(0x00);
        while (nullIdx !== -1) {
          const packet = buffer.subarray(0, nullIdx);
          const request: RequestDto<any> = JSON.parse(packet.toString());
          this.parsePacket(socket, request);

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
    socket.write(JSON.stringify(request) + '\0');
  }

  private sendResponse<T>(socket: net.Socket, response: ResponseDto<T>) {
    this.logger.log('Sending response to socket');
    socket.write(JSON.stringify(response) + '\0');
  }

  sendToAll<T>(response: ResponseDto<T>) {
    this.logger.log('Sending response to all connected sockets');
    this.connectedSockets.forEach((socket) => {
      socket.write(JSON.stringify(response) + '\0');
    });
  }

  async sendInitData(socket: net.Socket) {
    this.logger.log('Sending init data to socket');
    const serverStatus = await this.socketService.getServerStatus();
    this.sendResponse(socket, {
      type: 'ServerStatus',
      data: serverStatus,
    });
  }

  private async parsePacket(socket: net.Socket, request: RequestDto<any>) {
    this.logger.log(
      `Received request of type ${request.type}, tag ${request.tag}, data ${JSON.stringify(request.data)}`,
    );
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
    } else if (request.type === 'WifiSettings') {
      const responseData = await this.socketService.getWifiSettings();
      this.sendResponseWithTag(socket, {
        type: 'WifiSettings',
        tag: request.tag,
        data: responseData,
      });
    } else if (request.type === 'PersonInfo') {
      const responseData = await this.socketService.getPersonInfo(
        request.data.cardId,
      );
      this.sendResponseWithTag(socket, {
        type: 'PersonInfo',
        tag: request.tag,
        data: responseData,
      });
    } else {
      this.logger.error('Unknown request type');
    }
  }
}
