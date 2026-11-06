import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import {
  BUZZER_VOLUME_MAX,
  BUZZER_VOLUME_MIN,
} from '../../device/buzzer-volume';

export class UpdateDevicesSettingsDto {
  @IsBoolean()
  shouldUpdateDevices: boolean;

  @IsString()
  @IsOptional()
  wifiSsid: string;

  @IsString()
  @IsOptional()
  wifiPassword: string;

  @IsBoolean()
  mdns: boolean;

  @IsString()
  @IsOptional()
  wsUrl: string;

  @IsString()
  @IsOptional()
  defaultLocale: string;

  @IsBoolean()
  hilTesting: boolean;

  @IsBoolean()
  secureRfid: boolean;

  @IsBoolean()
  soundEnabled: boolean;

  @IsInt()
  @Min(BUZZER_VOLUME_MIN)
  @Max(BUZZER_VOLUME_MAX)
  @IsOptional()
  buzzerVolume?: number | null;
}
