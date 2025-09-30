import { IsBoolean, IsOptional, IsString } from 'class-validator';

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
}
