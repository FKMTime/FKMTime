import { Module } from '@nestjs/common';
import { DeviceService } from './device.service';
import { DeviceController } from './device.controller';
import { AuthModule } from '../auth/auth.module';
import { DeviceGateway } from './device.gateway';

@Module({
  providers: [DeviceService, DeviceGateway],
  controllers: [DeviceController],
  exports: [DeviceService],
  imports: [AuthModule],
})
export class DeviceModule {}
