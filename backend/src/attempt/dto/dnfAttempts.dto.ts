import { IsArray, IsOptional, IsString } from 'class-validator';

export class DnfAttemptsDto {
  /** Completed attempts to set to DNF; may be empty for a disqualification */
  @IsArray()
  @IsString({ each: true })
  attemptIds: string[];

  /** Disqualify from this result's round: its remaining attempts become DNF */
  @IsOptional()
  @IsString()
  remainingInResultId?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
