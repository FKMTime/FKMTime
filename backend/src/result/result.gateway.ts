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

@WebSocketGateway({
  namespace: '/result',
  transports: ['websocket'],
  cors: {
    origin: '*',
  },
})
@UseGuards(AuthGuard('jwt'))
export class ResultGateway {
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
  async handleJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody('roundId') roundId: string,
  ) {
    this.handleConnection(socket);
    socket.join(`results-${roundId}`);
  }

  @SubscribeMessage('leave')
  async handleLeave(
    @ConnectedSocket() socket: Socket,
    @MessageBody('roundId') roundId: string,
  ) {
    this.handleDisconnect(socket);
    socket.leave(`results-${roundId}`);
  }

  @SubscribeMessage('resultEntered')
  handleResultEntered(roundId: string) {
    this.server.to(`results-${roundId}`).emit('resultEntered');
  }
}
