import {
  IsBoolean,
  IsDate,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class EnterAttemptDto {
  @IsInt()
  value: number;

  //-1 - DNF
  //2, 4, 6, 8, 10, 12, 14, 16 - penalties
  //0 - no penalty
  @IsInt()
  penalty: number;

  @IsInt()
  inspectionTime: number;

  @IsDate()
  solvedAt: Date;

  @IsInt()
  espId: number;

  @IsInt()
  @IsOptional()
  judgeId?: number;

  @IsInt()
  competitorId: number;

  @IsBoolean()
  @IsOptional()
  isDelegate: boolean;

  @IsString()
  sessionId: string;
}
