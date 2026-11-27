import { Module } from '@nestjs/common';

import { H2hController } from './h2h.controller';
import { H2hService } from './h2h.service';

@Module({
  providers: [H2hService],
  controllers: [H2hController],
})
export class H2hModule {}
