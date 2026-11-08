import { ArrayNotEmpty, IsArray, IsOptional, IsString } from 'class-validator';

export class DnfAttemptsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  attemptIds: string[];

  @IsOptional()
  @IsString()
  comment?: string;
}
