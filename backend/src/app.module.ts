import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { AuthModule } from './auth/auth.module';
import { DbModule } from './db/db.module';
import { AccountModule } from './account/account.module';
import { CompetitionModule } from './competition/competition.module';
import { PersonModule } from './person/person.module';
import { ResultModule } from './result/result.module';

@Module({
  imports: [
    DbModule,
    AuthModule,
    MailerModule.forRootAsync({
      useFactory: () => ({
        transport: {
          host: process.env.SMTP_HOST,
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        },
        defaults: {
          from: `SLSTimes <${process.env.SMTP_USER}>`,
        },
      }),
    }),
    AccountModule,
    CompetitionModule,
    PersonModule,
    ResultModule,
  ],
})
export class AppModule {}
