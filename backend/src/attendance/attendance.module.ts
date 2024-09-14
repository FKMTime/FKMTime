import { forwardRef, Module } from '@nestjs/common';
import { AppModule } from 'src/app.module';

import { AuthModule } from '../auth/auth.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

@Module({
  providers: [AttendanceService],
  controllers: [AttendanceController],
  imports: [AuthModule, forwardRef(() => AppModule)],
  exports: [AttendanceService],
})
export class AttendanceModule {}
