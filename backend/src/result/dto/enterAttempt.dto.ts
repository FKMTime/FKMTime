import {
  IsBoolean,
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { groupIdRegex } from 'src/constants';

export class EnterAttemptDto {
  @IsInt()
  value: number;

  @IsInt()
  valueMs: number;

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

  @IsString()
  @Matches(groupIdRegex)
  @IsOptional()
  groupId: string;
}
