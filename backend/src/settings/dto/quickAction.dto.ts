import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class QuickActionDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  comment: string;

  @IsBoolean()
  giveExtra: boolean;

  @IsBoolean()
  isShared: boolean;
}
