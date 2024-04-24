import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SocketModule } from '../socket/socket.module';
import { DeviceController } from './device.controller';
import { DeviceGateway } from './device.gateway';
import { DeviceService } from './device.service';

@Module({
  providers: [DeviceService, DeviceGateway],
  controllers: [DeviceController],
  exports: [DeviceService],
  imports: [AuthModule, forwardRef(() => SocketModule)],
})
export class DeviceModule {}
