import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateCompetitionDto {
  @IsString()
  @IsNotEmpty()
  scoretakingToken: string;

  @IsOptional()
  @IsString()
  currentGroupId: string;

  @IsBoolean()
  usesWcaProduction: boolean;

  @IsBoolean()
  shouldCheckGroup: boolean;

  @IsBoolean()
  shouldUpdateDevices: boolean;

  @IsBoolean()
  useStableReleases: boolean;
}
