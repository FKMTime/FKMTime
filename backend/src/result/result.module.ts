import { forwardRef, Module } from '@nestjs/common';
import { ResultService } from './result.service';
import { ResultController } from './result.controller';
import { AuthModule } from '../auth/auth.module';
import { AttemptModule } from '../attempt/attempt.module';
import { ResultGateway } from './result.gateway';
import { AttendanceModule } from '../attendance/attendance.module';
import { WcaModule } from '../wca/wca.module';
import { DeviceModule } from '../device/device.module';
import { PersonModule } from '../person/person.module';
import { ContestsModule } from 'src/contests/contests.module';

@Module({
  providers: [ResultService, ResultGateway],
  controllers: [ResultController],
  imports: [
    AuthModule,
    forwardRef(() => AttemptModule),
    AttendanceModule,
    WcaModule,
    ContestsModule,
    DeviceModule,
    PersonModule,
  ],
  exports: [ResultService],
})
export class ResultModule {}
