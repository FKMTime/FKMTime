import { forwardRef, Module } from '@nestjs/common';

import { AttendanceModule } from '../attendance/attendance.module';
import { CompetitionModule } from '../competition/competition.module';
import { DeviceModule } from '../device/device.module';
import { PersonModule } from '../person/person.module';
import { ResultModule } from '../result/result.module';
import { SocketController } from './socket.controller';
import { SocketServer } from './socket.server';
import { SocketService } from './socket.service';

@Module({
  imports: [
    forwardRef(() => ResultModule),
    forwardRef(() => DeviceModule),
    forwardRef(() => AttendanceModule),
    forwardRef(() => CompetitionModule),
    forwardRef(() => PersonModule),
  ],
  providers: [SocketServer, SocketService, SocketController],
  controllers: [SocketController],
  exports: [SocketServer, SocketController],
})
export class SocketModule {}
