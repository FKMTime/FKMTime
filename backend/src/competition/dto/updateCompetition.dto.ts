import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class UpdateCompetitionDto {
  @IsString()
  @IsNotEmpty()
  scoretakingToken: string;

  @IsBoolean()
  usesWcaProduction: boolean;

  @IsBoolean()
  shouldUpdateDevices: boolean;

  @IsBoolean()
  useStableReleases: boolean;
}
