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
import { isServerLogSource, ServerLogSource } from './serverLog';
import { ServerLogService } from './serverLog.service';

export const serverLogsRoom = (source: ServerLogSource) =>
  `serverLogs-${source}`;

/**
 * Admins watching a server log live (SPEC-011). Shares the socket.io server
 * with AppGateway, like DeviceLogGateway.
 */
@WebSocketGateway({
  namespace: '/',
  transports: ['websocket'],
  cors: {
    origin: '*',
  },
})
export class ServerLogGateway {
  @WebSocketServer() server: Namespace;

  constructor(private readonly serverLogService: ServerLogService) {}

  private watchers(room: string) {
    return this.server.adapter.rooms.get(room)?.size ?? 0;
  }

  @SubscribeMessage('joinServerLogs')
  @UseGuards(AdminGuard)
  async handleJoinServerLogs(
    @MessageBody() data: { source: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const source = data?.source;
    if (!isServerLogSource(source)) return;
    const room = serverLogsRoom(source);
    socket.join(room);
    const snapshot = await this.serverLogService.watch(source, {
      hasWatchers: () => this.watchers(room) > 0,
      onLines: (event) => this.server.to(room).emit('serverLogLines', event),
      onSnapshot: (event) =>
        this.server.to(room).emit('serverLogSnapshot', event),
    });
    socket.emit('serverLogSnapshot', snapshot);
  }

  @SubscribeMessage('leaveServerLogs')
  @UseGuards(AdminGuard)
  async handleLeaveServerLogs(
    @MessageBody() data: { source: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const source = data?.source;
    if (!isServerLogSource(source)) return;
    socket.leave(serverLogsRoom(source));
    this.serverLogService.release(source);
  }
}
