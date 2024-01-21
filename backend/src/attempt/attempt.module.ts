import { Module } from '@nestjs/common';
import { AttemptService } from './attempt.service';
import { AttemptController } from './attempt.controller';

@Module({
  providers: [AttemptService],
  controllers: [AttemptController],
})
export class AttemptModule {}
