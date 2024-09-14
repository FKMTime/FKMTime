import { AttemptStatus, AttemptType } from '@prisma/client';
import {
  IsEnum,
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

  @IsString()
  competitorId: string;

  @IsEnum(AttemptStatus)
  status: AttemptStatus;

  @IsEnum(AttemptType)
  type: AttemptType;

  @IsString()
  @IsOptional()
  comment: string;
}
