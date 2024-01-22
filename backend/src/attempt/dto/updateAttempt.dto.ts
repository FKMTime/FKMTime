import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateAttemptDto {
  @IsInt()
  @Min(1)
  attemptNumber: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  replacedBy: number;

  @IsBoolean()
  isDelegate: boolean;

  @IsBoolean()
  extraGiven: boolean;

  @IsBoolean()
  isResolved: boolean;

  @IsInt()
  penalty: number;

  @IsInt()
  value: number;

  @IsOptional()
  @IsBoolean()
  submitToWcaLive: boolean;
}
