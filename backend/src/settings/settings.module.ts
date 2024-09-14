import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  providers: [SettingsService],
  controllers: [SettingsController],
  imports: [AuthModule],
})
export class SettingsModule {}
