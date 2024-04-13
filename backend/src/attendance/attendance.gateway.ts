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

@WebSocketGateway({
  namespace: '/attendance',
  transports: ['websocket'],
  cors: {
    origin: '*',
  },
})
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class AttendanceGateway {
  @WebSocketServer() server: Server;

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody('groupId') groupId: string,
  ) {
    socket.join(`attendance-${groupId}`);
  }

  @SubscribeMessage('leave')
  async handleLeave(
    @ConnectedSocket() socket: Socket,
    @MessageBody('groupId') groupId: string,
  ) {
    socket.leave(`attendance-${groupId}`);
  }

  handleNewAttendance(groupId: string, competitorId: string) {
    this.server.to(`attendance-${groupId}`).emit('newAttendance', {
      competitorId,
    });
  }
}
