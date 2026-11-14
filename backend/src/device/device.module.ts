import { forwardRef, Module } from '@nestjs/common';
import { AppModule } from 'src/app.module';

import { AuthModule } from '../auth/auth.module';
import { SocketModule } from '../socket/socket.module';
import { DeviceController } from './device.controller';
import { DeviceService } from './device.service';
import { StationSignalService } from './stationSignal.service';

@Module({
  providers: [DeviceService, StationSignalService],
  controllers: [DeviceController],
  exports: [DeviceService, StationSignalService],
  imports: [
    AuthModule,
    forwardRef(() => SocketModule),
    forwardRef(() => AppModule),
  ],
})
export class DeviceModule {}
