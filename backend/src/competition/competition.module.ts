import { forwardRef, Module } from '@nestjs/common';
import { SocketModule } from '../socket/socket.module';
import { WcaModule } from '../wca/wca.module';
import { CompetitionService } from './competition.service';
import { CompetitionController } from './competition.controller';
import { AuthModule } from 'src/auth/auth.module';
import { ResultModule } from 'src/result/result.module';
import { AppModule } from 'src/app.module';
import { RoomsService } from './rooms.service';
import { ImportService } from './import.service';
import { SyncService } from './sync.service';
import { DbModule } from 'src/db/db.module';

@Module({
  providers: [CompetitionService, RoomsService, ImportService, SyncService],
  controllers: [CompetitionController],
  imports: [
    AuthModule,
    WcaModule,
    DbModule,
    forwardRef(() => SocketModule),
    ResultModule,
    forwardRef(() => AppModule),
  ],
  exports: [CompetitionService, SyncService],
})
export class CompetitionModule {}
