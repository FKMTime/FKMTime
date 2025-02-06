import { AttemptStatus, AttemptType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { roundIdRegex } from 'src/constants';

export class CreateAttemptDto {
  @IsInt()
  attemptNumber: number;

  @IsInt()
  value: number;

  @IsInt()
  penalty: number;

  @IsString()
  @Matches(roundIdRegex)
  @IsNotEmpty()
  roundId: string;

  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsString()
  @IsOptional()
  judgeId?: string;

  @IsString()
  @IsOptional()
  scramblerId?: string;

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
