import { forwardRef, Module } from '@nestjs/common';
import { AppModule } from 'src/app.module';
import { ContestsModule } from 'src/contests/contests.module';

import { AttemptModule } from '../attempt/attempt.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { AuthModule } from '../auth/auth.module';
import { DeviceModule } from '../device/device.module';
import { PersonModule } from '../person/person.module';
import { WcaModule } from '../wca/wca.module';
import { ResultController } from './result.controller';
import { ResultService } from './result.service';
import { ResultFromDeviceService } from './resultFromDevice.service';

@Module({
  providers: [ResultService, ResultFromDeviceService],
  controllers: [ResultController],
  imports: [
    AuthModule,
    forwardRef(() => AttemptModule),
    AttendanceModule,
    WcaModule,
    ContestsModule,
    DeviceModule,
    PersonModule,
    forwardRef(() => AppModule),
  ],
  exports: [ResultService, ResultFromDeviceService],
})
export class ResultModule {}
