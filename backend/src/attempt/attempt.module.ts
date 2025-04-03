import { forwardRef, Module } from '@nestjs/common';
import { AppModule } from 'src/app.module';
import { AttendanceModule } from 'src/attendance/attendance.module';
import { ContestsModule } from 'src/contests/contests.module';
import { IncidentModule } from 'src/incident/incident.module';

import { AuthModule } from '../auth/auth.module';
import { ResultModule } from '../result/result.module';
import { SocketModule } from '../socket/socket.module';
import { WcaModule } from '../wca/wca.module';
import { AttemptController } from './attempt.controller';
import { AttemptService } from './attempt.service';

@Module({
  providers: [AttemptService],
  controllers: [AttemptController],
  imports: [
    AuthModule,
    WcaModule,
    AttendanceModule,
    ContestsModule,
    IncidentModule,
    forwardRef(() => ResultModule),
    forwardRef(() => SocketModule),
    forwardRef(() => AppModule),
  ],
  exports: [],
})
export class AttemptModule {}
