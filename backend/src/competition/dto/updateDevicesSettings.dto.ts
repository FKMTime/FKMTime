import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

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
  ipAddress: string;

  @IsNumber()
  @IsOptional()
  port: number;

  @IsBoolean()
  secure: boolean;
}
