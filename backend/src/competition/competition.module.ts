import { Module } from '@nestjs/common';
import { CompetitionService } from './competition.service';
import { CompetitionController } from './competition.controller';

@Module({
  providers: [CompetitionService],
  controllers: [CompetitionController]
})
export class CompetitionModule {}
