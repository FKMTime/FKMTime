import { Module } from '@nestjs/common';

import { ScramblingDeviceController } from './scrambling-device.controller';
import { ScramblingDeviceService } from './scrambling-device.service';

@Module({
  providers: [ScramblingDeviceService],
  controllers: [ScramblingDeviceController],
})
export class ScramblingDeviceModule {}
