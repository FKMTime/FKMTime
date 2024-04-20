import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DeviceController } from './device.controller';
import { DeviceGateway } from './device.gateway';
import { DeviceService } from './device.service';

@Module({
  providers: [DeviceService, DeviceGateway],
  controllers: [DeviceController],
  exports: [DeviceService],
  imports: [AuthModule],
})
export class DeviceModule {}
