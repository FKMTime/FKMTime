import { forwardRef, Module } from '@nestjs/common';
import { AppModule } from 'src/app.module';
import { AuthModule } from 'src/auth/auth.module';
import { DbModule } from 'src/db/db.module';
import { PersonModule } from 'src/person/person.module';
import { ResultModule } from 'src/result/result.module';

import { IntegratedLiveService } from '../integrated-live/integratedLive.service';
import { SocketModule } from '../socket/socket.module';
import { WcaModule } from '../wca/wca.module';
import { AutoSetupGateway } from './autosetup.gateway';
import { CompetitionController } from './competition.controller';
import { CompetitionService } from './competition.service';
import { ImportService } from './import.service';
import { IntegratedLiveConnectionService } from './integratedLiveConnection.service';
import { RoomsService } from './rooms.service';
import { StatisticsService } from './statistics.service';
import { SyncService } from './sync.service';

@Module({
  providers: [
    CompetitionService,
    RoomsService,
    ImportService,
    SyncService,
    StatisticsService,
    AutoSetupGateway,
    IntegratedLiveConnectionService,
    IntegratedLiveService,
  ],
  controllers: [CompetitionController],
  imports: [
    AuthModule,
    WcaModule,
    DbModule,
    forwardRef(() => SocketModule),
    forwardRef(() => ResultModule),
    forwardRef(() => PersonModule),
    forwardRef(() => AppModule),
  ],
  exports: [
    CompetitionService,
    SyncService,
    IntegratedLiveConnectionService,
    IntegratedLiveService,
  ],
})
export class CompetitionModule {}
