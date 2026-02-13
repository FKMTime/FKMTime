import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';

import { CreateAttemptDto } from './createAttempt.dto';
import { UpdateAttemptDto } from './updateAttempt.dto';

export class EnterScorecardDto {
  @IsString()
  @IsNotEmpty()
  resultId: string;

  @ValidateNested({ each: true })
  @Type(() => AttemptDto)
  attempts: AttemptDto[];

  @ValidateNested({ each: true })
  @Type(() => CreateAttemptDto)
  newAttempts: CreateAttemptDto[];
}

class AttemptDto extends UpdateAttemptDto {
  @IsString()
  @IsNotEmpty()
  id: string;
}
