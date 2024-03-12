import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  providers: [AttendanceService],
  controllers: [AttendanceController],
  imports: [AuthModule],
})
export class AttendanceModule {}
