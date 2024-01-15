import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';

@Module({
  providers: [SettingsService],
  controllers: [SettingsController]
})
export class SettingsModule {}
