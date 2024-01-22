import { Module } from '@nestjs/common';
import { AttemptService } from './attempt.service';
import { AttemptController } from './attempt.controller';
import { ResultModule } from 'src/result/result.module';

@Module({
  providers: [AttemptService],
  controllers: [AttemptController],
  imports: [ResultModule],
})
export class AttemptModule {}
