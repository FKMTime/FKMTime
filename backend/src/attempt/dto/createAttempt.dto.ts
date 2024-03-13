import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateAttemptDto {
  @IsInt()
  attemptNumber: number;

  @IsInt()
  value: number;

  @IsInt()
  penalty: number;

  @IsString()
  @IsNotEmpty()
  roundId: string;

  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsString()
  @IsOptional()
  judgeId?: string;

  @IsInt()
  @IsOptional()
  replacedBy: number;

  @IsBoolean()
  isDelegate: boolean;

  @IsString()
  competitorId: string;

  @IsBoolean()
  isExtraAttempt: boolean;

  @IsBoolean()
  extraGiven: boolean;

  @IsBoolean()
  isResolved: boolean;

  @IsString()
  @IsOptional()
  comment: string;

  @IsBoolean()
  @IsOptional()
  submitToWcaLive: boolean;
}
