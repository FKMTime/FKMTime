import { forwardRef, Module } from '@nestjs/common';
import { AppModule } from 'src/app.module';
import { CompetitionModule } from 'src/competition/competition.module';

import { AuthModule } from '../auth/auth.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

@Module({
  providers: [AttendanceService],
  controllers: [AttendanceController],
  imports: [
    AuthModule,
    forwardRef(() => AppModule),
    forwardRef(() => CompetitionModule),
  ],
  exports: [AttendanceService],
})
export class AttendanceModule {}
