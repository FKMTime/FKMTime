import { IsBoolean, IsDate, IsInt, IsOptional } from 'class-validator';

export class EnterAttemptDto {
  @IsInt()
  value: number;

  //-1 - DNF
  //2, 4, 6, 8, 10, 12, 14, 16 - penalties
  //0 - no penalty
  @IsInt()
  penalty: number;

  @IsDate()
  solvedAt: Date;

  @IsInt()
  espId: number;

  @IsInt()
  judgeId: number;

  @IsInt()
  competitorId: number;

  @IsBoolean()
  @IsOptional()
  isDelegate: boolean;
}
