import { Module } from '@nestjs/common';
import { ContestsService } from './contests.service';
import { WcaModule } from 'src/wca/wca.module';

@Module({
  imports: [WcaModule],
  providers: [ContestsService],
  exports: [ContestsService],
})
export class ContestsModule {}
