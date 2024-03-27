import { Module } from '@nestjs/common';
import { AttemptService } from './attempt.service';
import { AttemptController } from './attempt.controller';
import { AuthModule } from '../auth/auth.module';
import { IncidentsGateway } from './incidents.gateway';
import { WcaModule } from '../wca/wca.module';

@Module({
  providers: [AttemptService, IncidentsGateway],
  controllers: [AttemptController],
  imports: [AuthModule, WcaModule],
  exports: [IncidentsGateway],
})
export class AttemptModule {}
