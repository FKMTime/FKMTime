import { SendingResultsFrequency } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class UpdateCompetitionDto {
  @IsString()
  @IsNotEmpty()
  scoretakingToken: string;

  @IsEnum(SendingResultsFrequency)
  sendingResultsFrequency: SendingResultsFrequency;
}
