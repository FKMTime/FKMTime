import { Module } from '@nestjs/common';
import { DeviceService } from './device.service';
import { DeviceController } from './device.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  providers: [DeviceService],
  controllers: [DeviceController],
  imports: [AuthModule],
})
export class DeviceModule {}
