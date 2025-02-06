import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsString,
  Matches,
} from 'class-validator';
import { roundIdRegex } from 'src/constants';

export class CreateScrambledAttemptDto {
  @IsString()
  @IsNotEmpty()
  personId: string;

  @IsString()
  @IsNotEmpty()
  scramblerId: string;

  @IsString()
  @Matches(roundIdRegex)
  @IsNotEmpty()
  roundId: string;

  @IsNumber()
  attemptNumber: number;

  @IsBoolean()
  isExtra: boolean;
}
