import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateDevicesSettingsDto {
  @IsBoolean()
  shouldUpdateDevices: boolean;

  @IsString()
  @IsOptional()
  wifiSsid: string;

  @IsString()
  @IsOptional()
  wifiPassword: string;
}
