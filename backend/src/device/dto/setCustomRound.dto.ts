import {
  ArrayNotEmpty,
  IsArray,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';
import { roundIdRegex } from 'src/constants';

export class SetCustomRoundDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  deviceIds: string[];

  /** The round to point the stations at, or null to send them back to their room */
  @ValidateIf((dto: SetCustomRoundDto) => dto.roundId !== null)
  @IsString()
  @Matches(new RegExp(`^${roundIdRegex}$`))
  roundId: string | null;
}
