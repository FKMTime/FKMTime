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
  namespace: '/incidents',
  transports: ['websocket'],
  cors: {
    origin: '*',
  },
})
@UseGuards(AuthGuard('jwt'), AdminOrDelegateGuard)
export class IncidentsGateway {
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
    socket.join(`incidents`);
  }

  @SubscribeMessage('leave')
  async handleLeave(@ConnectedSocket() socket: Socket) {
    this.handleDisconnect(socket);
    socket.leave(`incidents`);
  }

  @SubscribeMessage('newIncident')
  handleNewIncident(deviceName: string, competitorName: string) {
    this.server.to(`incidents`).emit('newIncident', {
      deviceName,
      competitorName,
    });
  }

  @SubscribeMessage('attemptUpdated')
  handleAttemptUpdated() {
    this.server.to(`incidents`).emit('attemptUpdated');
  }
}
