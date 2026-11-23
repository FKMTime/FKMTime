import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { roundIdRegex } from 'src/constants';

import { CreateAttemptDto } from './createAttempt.dto';
import { UpdateAttemptDto } from './updateAttempt.dto';

/**
 * A scorecard names the competitor and round rather than a result: the
 * result may not exist yet, and saving the scorecard is what creates it.
 */
export class EnterScorecardDto {
  @IsString()
  @Matches(roundIdRegex)
  @IsNotEmpty()
  roundId: string;

  @IsString()
  @IsNotEmpty()
  personId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttemptDto)
  attempts: AttemptDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAttemptDto)
  newAttempts: CreateAttemptDto[];
}

class AttemptDto extends UpdateAttemptDto {
  @IsString()
  @IsNotEmpty()
  id: string;
}
