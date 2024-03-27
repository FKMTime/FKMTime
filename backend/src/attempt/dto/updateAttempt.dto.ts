import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { AttemptStatus } from '@prisma/client';

export class UpdateAttemptDto {
  @IsInt()
  @Min(1)
  attemptNumber: number;

  @IsOptional()
  @IsInt()
  replacedBy: number;

  @IsString()
  @IsOptional()
  judgeId: string;

  @IsEnum(AttemptStatus)
  status: AttemptStatus;

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
