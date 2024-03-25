import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminOrDelegateGuard } from '../auth/guards/adminOrDelegate.guard';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/attendance',
  transports: ['websocket'],
  cors: {
    origin: '*',
  },
})
@UseGuards(AuthGuard('jwt'), AdminOrDelegateGuard)
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
