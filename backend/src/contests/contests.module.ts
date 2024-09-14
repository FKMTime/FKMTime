import { Module } from '@nestjs/common';
import { WcaModule } from 'src/wca/wca.module';

import { ContestsService } from './contests.service';

@Module({
  imports: [WcaModule],
  providers: [ContestsService],
  exports: [ContestsService],
})
export class ContestsModule {}
