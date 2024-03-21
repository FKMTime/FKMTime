import {
  ConnectedSocket,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Server, Socket } from 'socket.io';
import { AdminOrDelegateGuard } from '../auth/guards/adminOrDelegate.guard';

@WebSocketGateway({
  namespace: '/competition',
  transports: ['websocket'],
  cors: {
    origin: '*',
  },
})
@UseGuards(AuthGuard('jwt'), AdminOrDelegateGuard)
export class CompetitionGateway {
  @WebSocketServer() server: Server;
  connectedClients = [];

  handleConnection(client: Socket) {
    this.connectedClients.push(client);
  }

  handleDisconnect(client: Socket) {
    this.connectedClients = this.connectedClients.filter(
      (c) => c.id !== client.id,
    );
  }
  @SubscribeMessage('join')
  async handleJoin(@ConnectedSocket() socket: Socket) {
    this.handleConnection(socket);
    socket.join(`competition`);
  }

  @SubscribeMessage('leave')
  async handleLeave(@ConnectedSocket() socket: Socket) {
    this.handleDisconnect(socket);
    socket.leave(`competition`);
  }

  @SubscribeMessage('groupShouldBeChanged')
  handleGroupShouldBeChanged(message: string) {
    this.server.to(`competition`).emit('groupShouldBeChanged', { message });
  }
}
