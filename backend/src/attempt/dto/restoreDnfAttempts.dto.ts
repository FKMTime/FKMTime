import { IsString } from 'class-validator';

export class RestoreDnfAttemptsDto {
  @IsString()
  resultId: string;
}
