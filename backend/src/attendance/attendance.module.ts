import { Module, forwardRef } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { AuthModule } from '../auth/auth.module';
import { AppModule } from 'src/app.module';

@Module({
  providers: [AttendanceService],
  controllers: [AttendanceController],
  imports: [AuthModule, forwardRef(() => AppModule)],
  exports: [AttendanceService],
})
export class AttendanceModule {}
