import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { AttemptStatus } from '@prisma/client';

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

  @IsString()
  competitorId: string;

  @IsEnum(AttemptStatus)
  status: AttemptStatus;

  @IsString()
  @IsOptional()
  comment: string;

  @IsBoolean()
  @IsOptional()
  submitToWcaLive: boolean;
}
