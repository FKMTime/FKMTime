import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { AuthModule } from '../auth/auth.module';
import { AttendanceGateway } from './attendance.gateway';

@Module({
  providers: [AttendanceService, AttendanceGateway],
  controllers: [AttendanceController],
  imports: [AuthModule],
  exports: [AttendanceService, AttendanceGateway],
})
export class AttendanceModule {}
