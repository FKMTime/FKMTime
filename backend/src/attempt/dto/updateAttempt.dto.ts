import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateAttemptDto {
  @IsInt()
  @Min(1)
  attemptNumber: number;

  @IsOptional()
  @IsInt()
  replacedBy: number;

  @IsInt()
  judgeId: number;

  @IsBoolean()
  isDelegate: boolean;

  @IsBoolean()
  isExtraAttempt: boolean;

  @IsBoolean()
  extraGiven: boolean;

  @IsBoolean()
  isResolved: boolean;

  @IsInt()
  penalty: number;

  @IsInt()
  value: number;

  @IsString()
  @IsOptional()
  comment: string;

  @IsOptional()
  @IsBoolean()
  submitToWcaLive: boolean;
}
