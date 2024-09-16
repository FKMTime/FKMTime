import { forwardRef, Module } from '@nestjs/common';
import { AppModule } from 'src/app.module';
import { AuthModule } from 'src/auth/auth.module';
import { DbModule } from 'src/db/db.module';
import { ResultModule } from 'src/result/result.module';

import { SocketModule } from '../socket/socket.module';
import { WcaModule } from '../wca/wca.module';
import { CompetitionController } from './competition.controller';
import { CompetitionService } from './competition.service';
import { ImportService } from './import.service';
import { RoomsService } from './rooms.service';
import { SyncService } from './sync.service';

@Module({
  providers: [CompetitionService, RoomsService, ImportService, SyncService],
  controllers: [CompetitionController],
  imports: [
    AuthModule,
    WcaModule,
    DbModule,
    forwardRef(() => SocketModule),
    forwardRef(() => ResultModule),
    forwardRef(() => AppModule),
  ],
  exports: [CompetitionService, SyncService],
})
export class CompetitionModule {}
