import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';

import { OrganizerGuard } from '../auth/guards/organizer.guard';
import { CompetitionService } from './competition.service';

@WebSocketGateway({
  namespace: '/',
  transports: ['websocket'],
  cors: {
    origin: '*',
  },
})
@UseGuards(AuthGuard('jwt'), OrganizerGuard)
export class AutoSetupGateway {
  constructor(private readonly competitionService: CompetitionService) {}

  @SubscribeMessage('autosetup:start')
  async handleAutoSetupStart() {
    await this.competitionService.handleAutoSetupHeartbeat();
  }

  @SubscribeMessage('autosetup:stop')
  async handleAutoSetupStop() {
    await this.competitionService.stopAutoSetup();
  }
}
