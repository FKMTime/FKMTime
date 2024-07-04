import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DbModule } from './db/db.module';
import { UserModule } from './user/user.module';
import { CompetitionModule } from './competition/competition.module';
import { PersonModule } from './person/person.module';
import { ResultModule } from './result/result.module';
import { AttemptModule } from './attempt/attempt.module';
import { SettingsModule } from './settings/settings.module';
import { DeviceModule } from './device/device.module';
import { AttendanceModule } from './attendance/attendance.module';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { ScheduleModule } from '@nestjs/schedule';
import { WcaModule } from './wca/wca.module';
import { HealthModule } from './health/health.module';
import { SocketModule } from './socket/socket.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    DbModule,
    ScheduleModule.forRoot(),
    AuthModule,
    UserModule,
    CompetitionModule,
    PersonModule,
    ResultModule,
    AttemptModule,
    SettingsModule,
    DeviceModule,
    AttendanceModule,
    WcaModule,
    HealthModule,
    SocketModule,
    EventsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
