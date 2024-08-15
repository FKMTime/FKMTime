import { SendingResultsFrequency } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateCompetitionDto {
  @IsString()
  @IsNotEmpty()
  scoretakingToken: string;

  @IsEnum(SendingResultsFrequency)
  sendingResultsFrequency: SendingResultsFrequency;

  @IsString()
  @IsOptional()
  cubingContestsToken: string;
}
