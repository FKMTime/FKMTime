import { forwardRef, Module } from '@nestjs/common';
import { AppModule } from 'src/app.module';
import { AttemptEditLogModule } from 'src/attempt-edit-log/attempt-edit-log.module';
import { CompetitionModule } from 'src/competition/competition.module';
import { SocketModule } from 'src/socket/socket.module';

import { H2hController } from './h2h.controller';
import { H2hService } from './h2h.service';
import { H2hMatchService } from './h2hMatch.service';
import { H2hMatchActionsService } from './h2hMatchActions.service';

@Module({
  providers: [H2hService, H2hMatchService, H2hMatchActionsService],
  controllers: [H2hController],
  imports: [
    forwardRef(() => AppModule),
    AttemptEditLogModule,
    forwardRef(() => SocketModule),
    forwardRef(() => CompetitionModule),
  ],
  exports: [H2hService, H2hMatchService],
})
export class H2hModule {}
