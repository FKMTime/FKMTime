import { forwardRef, Module } from '@nestjs/common';
import { ResultService } from './result.service';
import { ResultController } from './result.controller';
import { AuthModule } from '../auth/auth.module';
import { AttemptModule } from '../attempt/attempt.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { WcaModule } from '../wca/wca.module';
import { DeviceModule } from '../device/device.module';
import { PersonModule } from '../person/person.module';
import { ContestsModule } from 'src/contests/contests.module';
import { AppModule } from 'src/app.module';
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
