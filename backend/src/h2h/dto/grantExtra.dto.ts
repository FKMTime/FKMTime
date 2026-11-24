import { IsOptional, IsString } from 'class-validator';

export class GrantExtraDto {
  /** Saved on both attempts, like the comment of any extra */
  @IsOptional()
  @IsString()
  comment?: string;
}
