import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { roundIdRegex } from 'src/constants';

export class ManualIncidentDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  personId: string;

  @IsString()
  @Matches(roundIdRegex)
  @IsNotEmpty()
  roundId: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsOptional()
  attempt: string;
}
