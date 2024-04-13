import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AdminGuard } from '../auth/guards/admin.guard';
import { RequestToConnectDto } from './dto/requestToConnect.dto';

@WebSocketGateway({
  namespace: '/device',
  transports: ['websocket'],
  cors: {
    origin: '*',
  },
})
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class DeviceGateway {
  @WebSocketServer() server: Server;
  deviceRequests: RequestToConnectDto[] = [];

  @SubscribeMessage('join')
  async handleJoin(@ConnectedSocket() socket: Socket) {
    socket.join(`device`);
    this.sendDeviceRequests(socket);
  }

  @SubscribeMessage('leave')
  async handleLeave(@ConnectedSocket() socket: Socket) {
    socket.leave(`device`);
  }

  @SubscribeMessage('deviceUpdated')
  handleDeviceUpdated() {
    this.server.to(`device`).emit('deviceUpdated');
  }

  @SubscribeMessage('deviceRequests')
  sendDeviceRequests(@ConnectedSocket() socket: Socket) {
    socket.emit('deviceRequests', this.deviceRequests);
  }

  handleDeviceRequest(device: RequestToConnectDto) {
    if (this.deviceRequests.some((req) => req.espId === device.espId)) return;
    this.deviceRequests.push(device);
    this.server.to(`device`).emit('deviceRequests', this.deviceRequests);
  }

  @SubscribeMessage('removeDeviceRequest')
  handleRemoveDeviceRequest(@MessageBody() data: { espId: number }) {
    this.deviceRequests = this.deviceRequests.filter(
      (device) => device.espId !== data.espId,
    );
    this.server.to(`device`).emit('deviceRequests', this.deviceRequests);
  }

  handleAddDeviceToDb(deviceId: number) {
    this.deviceRequests = this.deviceRequests.filter(
      (device) => device.espId !== deviceId,
    );
    this.server.to(`device`).emit('deviceRequests', this.deviceRequests);
  }
}
