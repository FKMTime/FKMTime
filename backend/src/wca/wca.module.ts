import { Module } from '@nestjs/common';

import { WcaService } from './wca.service';

@Module({
  providers: [WcaService],
  exports: [WcaService],
})
export class WcaModule {}
