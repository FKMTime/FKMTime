import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ImportScramblesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ScrambleSet)
  scrambleSets: ScrambleSet[];
}

class ScrambleSet {
  @IsString()
  roundId: string;

  @IsString()
  set: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => Scramble)
  scrambles: Scramble[];
}

class Scramble {
  @IsNumber()
  num: number;

  @IsString()
  encryptedScramble: string;

  @IsBoolean()
  isExtra: boolean;
}
