import { SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';

import { CompetitionService } from './competition.service';

@WebSocketGateway()
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
