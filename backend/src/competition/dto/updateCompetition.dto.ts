import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

import { SendingResultsFrequency } from '../../generated/prisma/client';

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

  @IsBoolean()
  useFkmTimeDevices: boolean;

  /** Open later rounds in WCA Integrated Live Results without asking */
  @IsBoolean()
  @IsOptional()
  openRoundsAutomatically?: boolean;
}
