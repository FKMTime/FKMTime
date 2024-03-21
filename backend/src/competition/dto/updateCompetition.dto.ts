import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class UpdateCompetitionDto {
  @IsString()
  @IsNotEmpty()
  scoretakingToken: string;

  @IsBoolean()
  sendResultsToWcaLive: boolean;
}
