import { forwardRef, Module } from '@nestjs/common';
import { SocketModule } from '../socket/socket.module';
import { AttemptService } from './attempt.service';
import { AttemptController } from './attempt.controller';
import { AuthModule } from '../auth/auth.module';
import { WcaModule } from '../wca/wca.module';
import { ResultModule } from '../result/result.module';
import { ContestsModule } from 'src/contests/contests.module';
import { AttendanceModule } from 'src/attendance/attendance.module';
import { AppModule } from 'src/app.module';

@Module({
  providers: [AttemptService],
  controllers: [AttemptController],
  imports: [
    AuthModule,
    WcaModule,
    AttendanceModule,
    ContestsModule,
    forwardRef(() => ResultModule),
    forwardRef(() => SocketModule),
    forwardRef(() => AppModule),
  ],
  exports: [],
})
export class AttemptModule {}
