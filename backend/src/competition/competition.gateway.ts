import {
  ConnectedSocket,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
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

  private logger = new Logger(`CompetitionGateway`);

  @SubscribeMessage('join')
  async handleJoin(@ConnectedSocket() socket: Socket) {
    socket.join(`competition`);
  }

  @SubscribeMessage('leave')
  async handleLeave(@ConnectedSocket() socket: Socket) {
    socket.leave(`competition`);
  }

  @SubscribeMessage('groupShouldBeChanged')
  handleGroupShouldBeChanged(message: string) {
    this.logger.log(`Group should be changed: ${message}`);
    this.server.to(`competition`).emit('groupShouldBeChanged', { message });
  }
}
