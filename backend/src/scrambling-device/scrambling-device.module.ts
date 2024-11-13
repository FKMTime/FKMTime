import { Global, Module } from '@nestjs/common';

import { ScramblingDeviceController } from './scrambling-device.controller';
import { ScramblingDeviceService } from './scrambling-device.service';

@Global()
@Module({
  providers: [ScramblingDeviceService],
  controllers: [ScramblingDeviceController],
  exports: [ScramblingDeviceService],
})
export class ScramblingDeviceModule {}
