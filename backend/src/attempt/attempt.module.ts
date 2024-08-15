import { forwardRef, Module } from '@nestjs/common';
import { SocketModule } from '../socket/socket.module';
import { AttemptService } from './attempt.service';
import { AttemptController } from './attempt.controller';
import { AuthModule } from '../auth/auth.module';
import { IncidentsGateway } from './incidents.gateway';
import { WcaModule } from '../wca/wca.module';
import { ResultModule } from '../result/result.module';
import { ContestsModule } from 'src/contests/contests.module';

@Module({
  providers: [AttemptService, IncidentsGateway],
  controllers: [AttemptController],
  imports: [
    AuthModule,
    WcaModule,
    ContestsModule,
    forwardRef(() => ResultModule),
    forwardRef(() => SocketModule),
  ],
  exports: [IncidentsGateway],
})
export class AttemptModule {}
