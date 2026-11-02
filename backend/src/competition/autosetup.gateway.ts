import { UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { OrganizerGuard } from 'src/auth/guards/organizer.guard';

import { CompetitionService } from './competition.service';

@WebSocketGateway()
export class AutoSetupGateway {
  constructor(private readonly competitionService: CompetitionService) {}

  @UseGuards(OrganizerGuard)
  @SubscribeMessage('autosetup:start')
  async handleAutoSetupStart(@ConnectedSocket() socket: Socket) {
    await this.competitionService.handleAutoSetupHeartbeat(socket.id);
  }

  @UseGuards(OrganizerGuard)
  @SubscribeMessage('autosetup:stop')
  async handleAutoSetupStop(@ConnectedSocket() socket: Socket) {
    await this.competitionService.stopAutoSetup(socket.id);
  }
}
