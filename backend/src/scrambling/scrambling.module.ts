import { Module } from '@nestjs/common';
import { H2hModule } from 'src/h2h/h2h.module';
import { PersonModule } from 'src/person/person.module';
import { ResultModule } from 'src/result/result.module';
import { ScrambleSetModule } from 'src/scramble-set/scramble-set.module';

import { ScramblingController } from './scrambling.controller';
import { ScramblingService } from './scrambling.service';

@Module({
  imports: [ScrambleSetModule, PersonModule, ResultModule, H2hModule],
  providers: [ScramblingService],
  controllers: [ScramblingController],
})
export class ScramblingModule {}
