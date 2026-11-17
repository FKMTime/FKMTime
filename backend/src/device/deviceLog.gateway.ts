import { UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';

import { AdminGuard } from '../auth/guards/admin.guard';
import { DeviceLogService } from './deviceLog.service';

export const deviceLogsRoom = (deviceId: string) => `deviceLogs-${deviceId}`;

/**
 * Admins watching a device's log live (SPEC-009). Shares the socket.io server
 * with AppGateway; kept apart so the device module owns its log files.
 */
@WebSocketGateway({
  namespace: '/',
  transports: ['websocket'],
  cors: {
    origin: '*',
  },
})
export class DeviceLogGateway {
  @WebSocketServer() server: Namespace;

  constructor(private readonly deviceLogService: DeviceLogService) {}

  private watchers(room: string) {
    return this.server.adapter.rooms.get(room)?.size ?? 0;
  }

  @SubscribeMessage('joinDeviceLogs')
  @UseGuards(AdminGuard)
  async handleJoinDeviceLogs(
    @MessageBody() data: { deviceId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const deviceId = data?.deviceId;
    if (typeof deviceId !== 'string') return;
    const room = deviceLogsRoom(deviceId);
    socket.join(room);
    const snapshot = await this.deviceLogService.watch(deviceId, {
      hasWatchers: () => this.watchers(room) > 0,
      onLines: (event) => this.server.to(room).emit('deviceLogLines', event),
      onSnapshot: (event) =>
        this.server.to(room).emit('deviceLogSnapshot', event),
    });
    socket.emit('deviceLogSnapshot', snapshot);
  }

  @SubscribeMessage('leaveDeviceLogs')
  @UseGuards(AdminGuard)
  async handleLeaveDeviceLogs(
    @MessageBody() data: { deviceId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const deviceId = data?.deviceId;
    if (typeof deviceId !== 'string') return;
    socket.leave(deviceLogsRoom(deviceId));
    this.deviceLogService.release(deviceId);
  }
}
