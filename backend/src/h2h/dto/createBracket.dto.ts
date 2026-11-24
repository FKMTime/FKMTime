import { IsIn, IsInt, IsObject, IsOptional } from 'class-validator';

import { BRACKET_SIZES, SetsToWinByStage } from '../bracket';

export class CreateBracketDto {
  /** Defaults to the previous round's top N when that is a bracket size */
  @IsOptional()
  @IsInt()
  @IsIn([...BRACKET_SIZES])
  size?: number;

  /** Sets to win per stage; every stage defaults to 1 */
  @IsOptional()
  @IsObject()
  setsToWin?: SetsToWinByStage;
}
