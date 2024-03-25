import { forwardRef, Module } from '@nestjs/common';
import { ResultService } from './result.service';
import { ResultController } from './result.controller';
import { AuthModule } from '../auth/auth.module';
import { AttemptModule } from '../attempt/attempt.module';
import { ResultGateway } from './result.gateway';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  providers: [ResultService, ResultGateway],
  controllers: [ResultController],
  exports: [ResultService],
  imports: [AuthModule, forwardRef(() => AttemptModule), AttendanceModule],
})
export class ResultModule {}
