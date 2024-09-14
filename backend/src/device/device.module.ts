import { forwardRef, Module } from '@nestjs/common';
import { AppModule } from 'src/app.module';

import { AuthModule } from '../auth/auth.module';
import { SocketModule } from '../socket/socket.module';
import { DeviceController } from './device.controller';
import { DeviceService } from './device.service';

@Module({
  providers: [DeviceService],
  controllers: [DeviceController],
  exports: [DeviceService],
  imports: [
    AuthModule,
    forwardRef(() => SocketModule),
    forwardRef(() => AppModule),
  ],
})
export class DeviceModule {}
