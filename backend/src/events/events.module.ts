import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { CompetitionModule } from 'src/competition/competition.module';

import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  providers: [EventsService],
  controllers: [EventsController],
  imports: [AuthModule, CompetitionModule],
})
export class EventsModule {}
