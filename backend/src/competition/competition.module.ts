import { Module } from '@nestjs/common';
import { CompetitionService } from './competition.service';
import { CompetitionController } from './competition.controller';
import { AuthModule } from 'src/auth/auth.module';
import { CompetitionGateway } from './competition.gateway';

@Module({
  providers: [CompetitionService, CompetitionGateway],
  controllers: [CompetitionController],
  imports: [AuthModule],
})
export class CompetitionModule {}
