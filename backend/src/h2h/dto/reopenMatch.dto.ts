import { IsString } from 'class-validator';

export class ReopenMatchDto {
  /** Why the match is reopened: required (Regulation 11l) */
  @IsString()
  comment: string;
}
