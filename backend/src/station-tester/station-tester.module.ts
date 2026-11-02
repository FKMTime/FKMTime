import { Module } from '@nestjs/common';

import { StationTesterController } from './station-tester.controller';
import { StationTesterService } from './station-tester.service';

@Module({
  controllers: [StationTesterController],
  providers: [StationTesterService],
})
export class StationTesterModule {}
