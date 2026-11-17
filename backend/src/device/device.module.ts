import { forwardRef, Module } from '@nestjs/common';
import { AppModule } from 'src/app.module';

import { AuthModule } from '../auth/auth.module';
import { SocketModule } from '../socket/socket.module';
import { DeviceController } from './device.controller';
import { DeviceService } from './device.service';
import { DeviceLogGateway } from './deviceLog.gateway';
import { DeviceLogService } from './deviceLog.service';
import { StationErrorService } from './stationError.service';
import { StationSignalService } from './stationSignal.service';

@Module({
  providers: [
    DeviceService,
    StationSignalService,
    StationErrorService,
    DeviceLogService,
    DeviceLogGateway,
  ],
  controllers: [DeviceController],
  exports: [DeviceService, StationSignalService, StationErrorService],
  imports: [
    AuthModule,
    forwardRef(() => SocketModule),
    forwardRef(() => AppModule),
  ],
})
export class DeviceModule {}
