import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DbModule } from './db/db.module';
import { AccountModule } from './account/account.module';
import { CompetitionModule } from './competition/competition.module';
import { PersonModule } from './person/person.module';
import { ResultModule } from './result/result.module';
import { AttemptModule } from './attempt/attempt.module';
import { SettingsModule } from './settings/settings.module';
import { DeviceModule } from './device/device.module';
import { AttendanceModule } from './attendance/attendance.module';

@Module({
  imports: [
    DbModule,
    AuthModule,
    AccountModule,
    CompetitionModule,
    PersonModule,
    ResultModule,
    AttemptModule,
    SettingsModule,
    DeviceModule,
    AttendanceModule,
  ],
})
export class AppModule {}
