import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';

@Module({
  providers: [SettingsService],
  controllers: [SettingsController],
  imports: [AuthModule],
})
export class SettingsModule {}
