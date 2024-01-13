import { Module } from '@nestjs/common';
import { ResultService } from './result.service';
import { ResultController } from './result.controller';

@Module({
  providers: [ResultService],
  controllers: [ResultController]
})
export class ResultModule {}
