import { IsInt, IsObject, IsOptional, Min } from 'class-validator';

import { SetsToWinByStage } from '../bracket';

export class UpdateBracketDto {
  /** The WCA website's round id for the CSV; null clears it */
  @IsOptional()
  @IsInt()
  @Min(1)
  wcaRoundId?: number | null;

  /** Only the stages to change */
  @IsOptional()
  @IsObject()
  setsToWin?: SetsToWinByStage;
}
