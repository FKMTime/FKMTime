import { SendingResultsFrequency } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateCompetitionDto {
  @IsString()
  @IsNotEmpty()
  scoretakingToken: string;

  @IsEnum(SendingResultsFrequency)
  sendingResultsFrequency: SendingResultsFrequency;

  @IsString()
  @IsOptional()
  cubingContestsToken: string;

  @IsBoolean()
  shouldChangeGroupsAutomatically: boolean;
}
