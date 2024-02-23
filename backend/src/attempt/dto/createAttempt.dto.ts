import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateAttemptDto {
  @IsInt()
  attemptNumber: number;

  @IsInt()
  value: number;

  @IsInt()
  penalty: number;

  @IsInt()
  stationId: number;

  @IsInt()
  @IsOptional()
  judgeId?: number;

  @IsInt()
  @IsOptional()
  replacedBy: number;

  @IsBoolean()
  isDelegate: boolean;

  @IsInt()
  competitorId: number;

  @IsBoolean()
  isExtraAttempt: boolean;

  @IsBoolean()
  extraGiven: boolean;

  @IsBoolean()
  isResolved: boolean;

  @IsString()
  @IsOptional()
  comment: string;
}
