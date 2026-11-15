import { forwardRef, Module } from '@nestjs/common';
import { AppModule } from 'src/app.module';

import { AuthModule } from '../auth/auth.module';
import { SocketModule } from '../socket/socket.module';
import { DeviceController } from './device.controller';
import { DeviceService } from './device.service';
import { DeviceLogGateway } from './deviceLog.gateway';
import { DeviceLogService } from './deviceLog.service';
import { StationSignalService } from './stationSignal.service';

@Module({
  providers: [
    DeviceService,
    StationSignalService,
    DeviceLogService,
    DeviceLogGateway,
  ],
  controllers: [DeviceController],
  exports: [DeviceService, StationSignalService],
  imports: [
    AuthModule,
    forwardRef(() => SocketModule),
    forwardRef(() => AppModule),
  ],
})
export class DeviceModule {}
