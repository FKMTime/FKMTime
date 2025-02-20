import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';
import { AppGateway } from './app.gateway';
import { AttemptModule } from './attempt/attempt.module';
import { AttendanceModule } from './attendance/attendance.module';
import { AuthModule } from './auth/auth.module';
import { CompetitionModule } from './competition/competition.module';
import { ContestsModule } from './contests/contests.module';
import { DbModule } from './db/db.module';
import { DeviceModule } from './device/device.module';
import { validate } from './env.validation';
import { EventsModule } from './events/events.module';
import { IncidentModule } from './incident/incident.module';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { PersonModule } from './person/person.module';
import { ResultModule } from './result/result.module';
import { ScrambleSetModule } from './scramble-set/scramble-set.module';
import { ScramblingModule } from './scrambling/scrambling.module';
import { ScramblingDeviceModule } from './scrambling-device/scrambling-device.module';
import { SettingsModule } from './settings/settings.module';
import { SocketModule } from './socket/socket.module';
import { UserModule } from './user/user.module';
import { WcaModule } from './wca/wca.module';

@Module({
  providers: [AppGateway],
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({
      envFilePath: process.env.NODE_ENV
        ? `.env.${process.env.NODE_ENV}`
        : '.env',
      validate,
      isGlobal: true,
    }),
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
    SocketModule,
    EventsModule,
    ContestsModule,
    ScramblingDeviceModule,
    ScrambleSetModule,
    ScramblingModule,
    IncidentModule,
  ],
  exports: [AppGateway],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
