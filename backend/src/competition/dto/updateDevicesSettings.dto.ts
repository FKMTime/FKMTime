import { IsBoolean, IsEnum } from 'class-validator';
import { ReleaseChannel } from '@prisma/client';

export class UpdateDevicesSettingsDto {
  @IsBoolean()
  shouldUpdateDevices: boolean;

  @IsEnum(ReleaseChannel)
  releaseChannel: ReleaseChannel;
}
