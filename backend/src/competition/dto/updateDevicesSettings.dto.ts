import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ReleaseChannel } from '@prisma/client';

export class UpdateDevicesSettingsDto {
  @IsBoolean()
  shouldUpdateDevices: boolean;

  @IsEnum(ReleaseChannel)
  releaseChannel: ReleaseChannel;

  @IsString()
  @IsOptional()
  wifiSsid: string;

  @IsString()
  @IsOptional()
  wifiPassword: string;
}
