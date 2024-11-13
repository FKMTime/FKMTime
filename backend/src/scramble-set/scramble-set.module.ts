import { Module } from '@nestjs/common';

import { ScrambleSetController } from './scramble-set.controller';
import { ScrambleSetService } from './scramble-set.service';

@Module({
  providers: [ScrambleSetService],
  controllers: [ScrambleSetController],
  exports: [ScrambleSetService],
})
export class ScrambleSetModule {}
