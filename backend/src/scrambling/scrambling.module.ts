import { Module } from '@nestjs/common';
import { ScrambleSetModule } from 'src/scramble-set/scramble-set.module';

import { ScramblingController } from './scrambling.controller';
import { ScramblingService } from './scrambling.service';

@Module({
  imports: [ScrambleSetModule],
  providers: [ScramblingService],
  controllers: [ScramblingController],
})
export class ScramblingModule {}
