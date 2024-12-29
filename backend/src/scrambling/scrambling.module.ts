import { Module } from '@nestjs/common';
import { PersonModule } from 'src/person/person.module';
import { ResultModule } from 'src/result/result.module';
import { ScrambleSetModule } from 'src/scramble-set/scramble-set.module';

import { ScramblingController } from './scrambling.controller';
import { ScramblingService } from './scrambling.service';

@Module({
  imports: [ScrambleSetModule, PersonModule, ResultModule],
  providers: [ScramblingService],
  controllers: [ScramblingController],
})
export class ScramblingModule {}
