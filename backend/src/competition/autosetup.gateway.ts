import { UseGuards } from '@nestjs/common';
import { SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { OrganizerGuard } from 'src/auth/guards/organizer.guard';

import { CompetitionService } from './competition.service';

@WebSocketGateway()
export class AutoSetupGateway {
  constructor(private readonly competitionService: CompetitionService) {}

  @UseGuards(OrganizerGuard)
  @SubscribeMessage('autosetup:start')
  async handleAutoSetupStart() {
    await this.competitionService.handleAutoSetupHeartbeat();
  }

  @UseGuards(OrganizerGuard)
  @SubscribeMessage('autosetup:stop')
  async handleAutoSetupStop() {
    await this.competitionService.stopAutoSetup();
  }
}
