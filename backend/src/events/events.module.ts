import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { AuthModule } from 'src/auth/auth.module';
import { CompetitionModule } from 'src/competition/competition.module';

@Module({
  providers: [EventsService],
  controllers: [EventsController],
  imports: [AuthModule, CompetitionModule],
})
export class EventsModule {}
