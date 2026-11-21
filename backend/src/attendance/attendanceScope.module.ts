import { Module } from '@nestjs/common';

import { AttendanceScopeService } from './attendanceScope.service';

/**
 * Its own module so the gateway and the attendance controller can both use
 * it without going through AttendanceModule's circular imports
 */
@Module({
  providers: [AttendanceScopeService],
  exports: [AttendanceScopeService],
})
export class AttendanceScopeModule {}
