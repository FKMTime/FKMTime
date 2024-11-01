import { Module } from '@nestjs/common';
import { ScrambleSetService } from './scramble-set.service';
import { ScrambleSetController } from './scramble-set.controller';

@Module({
  providers: [ScrambleSetService],
  controllers: [ScrambleSetController]
})
export class ScrambleSetModule {}
