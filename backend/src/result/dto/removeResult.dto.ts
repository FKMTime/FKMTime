import { IsOptional, IsString } from 'class-validator';

export class RemoveResultDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
