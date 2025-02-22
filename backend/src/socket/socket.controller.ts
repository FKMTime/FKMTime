import { Controller, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { SocketServer } from './socket.server';
import { SocketService } from './socket.service';

@Controller('socket')
export class SocketController implements OnModuleInit, OnModuleDestroy {
  private readonly socketPath: string =
    process.env.SOCKET_PATH || '/tmp/socket.sock';
  constructor(
    private socketServer: SocketServer,
    private readonly socketService: SocketService,
  ) {}

  onModuleInit() {
    this.socketServer = new SocketServer(this.socketPath, this.socketService);
    this.socketServer.start(() => {});
  }

  onModuleDestroy() {
    this.socketServer.stop(() => {});
  }

  sendResponseToAllSockets(data: any) {
    this.socketServer.sendToAll(data);
  }

  async sendServerStatus() {
    await this.socketServer.sendServerStatus();
  }

  async sendFirmware(fileName: string, fileData: string) {
    await this.socketServer.sendFirmware(fileName, fileData);
  }

  async sendAutoSetupStatus() {
    await this.socketServer.sendAutoSetupStatus();
  }

  async toggleHil(state: boolean) {
    await this.socketServer.toggleHil(state);
  }

  hilRunning(): boolean {
    return this.socketServer.hilRunning;
  }
}
