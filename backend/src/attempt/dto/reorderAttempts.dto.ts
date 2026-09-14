import { IsArray, IsString } from 'class-validator';

export class ReorderAttemptsDto {
  @IsArray()
  @IsString({ each: true })
  attemptIds: string[];

  @IsString()
  resultId: string;
}
