import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { StationTesterController } from './station-tester.controller';
import { StationTesterService } from './station-tester.service';
import { isStationTesterEnabled } from './stationTesterEnabled.guard';

@Module({
  imports: [AuthModule],
  controllers: [StationTesterController],
  providers: [StationTesterService],
})
export class StationTesterModule implements OnModuleInit {
  private readonly logger = new Logger(StationTesterModule.name);

  onModuleInit() {
    // The dev stack always has it; anywhere else it should be a PR preview
    if (isStationTesterEnabled() && process.env.NODE_ENV !== 'development') {
      this.logger.warn(
        'The station tester is on (STATION_TESTER_ENABLED=true): any admin can send packets as any station. Turn it off unless this is a PR preview.',
      );
    }
  }
}
