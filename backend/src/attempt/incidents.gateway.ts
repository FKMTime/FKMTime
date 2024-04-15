import { Logger, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ConnectedSocket,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AdminGuard } from '../auth/guards/admin.guard';

@WebSocketGateway({
  namespace: '/incidents',
  transports: ['websocket'],
  cors: {
    origin: '*',
  },
})
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class IncidentsGateway {
  @WebSocketServer() server: Server;

  private logger = new Logger(`IncidentsGateway`);

  @SubscribeMessage('join')
  async handleJoin(@ConnectedSocket() socket: Socket) {
    socket.join(`incidents`);
  }

  @SubscribeMessage('leave')
  async handleLeave(@ConnectedSocket() socket: Socket) {
    socket.leave(`incidents`);
  }

  @SubscribeMessage('newIncident')
  handleNewIncident(
    deviceName: string,
    competitorName: string,
    attemptId: string,
  ) {
    this.logger.log(
      `New incident on station ${deviceName} - ${competitorName}`,
    );
    this.server.to(`incidents`).emit('newIncident', {
      id: attemptId,
      deviceName,
      competitorName,
    });
  }

  @SubscribeMessage('attemptUpdated')
  handleAttemptUpdated() {
    this.server.to(`incidents`).emit('attemptUpdated');
  }
}
