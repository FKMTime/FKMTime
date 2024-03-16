import { IsBoolean, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ReleaseChannel } from '@prisma/client';

export class UpdateCompetitionDto {
  @IsString()
  @IsNotEmpty()
  scoretakingToken: string;

  @IsBoolean()
  sendResultsToWcaLive: boolean;

  @IsBoolean()
  shouldUpdateDevices: boolean;

  @IsEnum(ReleaseChannel)
  releaseChannel: ReleaseChannel;
}
