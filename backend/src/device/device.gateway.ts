import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Server, Socket } from 'socket.io';
import { AdminOrDelegateGuard } from '../auth/guards/adminOrDelegate.guard';

@WebSocketGateway({
  namespace: '/device',
  transports: ['websocket'],
  cors: {
    origin: '*',
  },
})
@UseGuards(AuthGuard('jwt'), AdminOrDelegateGuard)
export class DeviceGateway {
  @WebSocketServer() server: Server;
  deviceRequests: number[] = [];

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

  handleDeviceRequest(deviceId: number) {
    if (this.deviceRequests.includes(deviceId)) return;
    this.deviceRequests.push(deviceId);
    this.server.to(`device`).emit('deviceRequests', this.deviceRequests);
  }

  @SubscribeMessage('removeDeviceRequest')
  handleRemoveDeviceRequest(@MessageBody() data: { espId: number }) {
    this.deviceRequests = this.deviceRequests.filter((id) => id !== data.espId);
    this.server.to(`device`).emit('deviceRequests', this.deviceRequests);
  }

  handleAddDeviceToDb(deviceId: number) {
    this.deviceRequests = this.deviceRequests.filter((id) => id !== deviceId);
    this.server.to(`device`).emit('deviceRequests', this.deviceRequests);
  }
}
