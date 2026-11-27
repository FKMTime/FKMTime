import { forwardRef, Module } from '@nestjs/common';
import { AppModule } from 'src/app.module';
import { H2hModule } from 'src/h2h/h2h.module';

import { ScrambleSetController } from './scramble-set.controller';
import { ScrambleSetService } from './scramble-set.service';

@Module({
  providers: [ScrambleSetService],
  controllers: [ScrambleSetController],
  imports: [H2hModule, forwardRef(() => AppModule)],
  exports: [ScrambleSetService],
})
export class ScrambleSetModule {}
