import { Module } from '@nestjs/common';
import { WcaModule } from '../wca/wca.module';
import { CompetitionService } from './competition.service';
import { CompetitionController } from './competition.controller';
import { AuthModule } from 'src/auth/auth.module';
import { CompetitionGateway } from './competition.gateway';

@Module({
  providers: [CompetitionService, CompetitionGateway],
  controllers: [CompetitionController],
  imports: [AuthModule, WcaModule],
  exports: [CompetitionService],
})
export class CompetitionModule {}
