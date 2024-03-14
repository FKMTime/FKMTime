import { IsString } from 'class-validator';

export class SwapAttemptsDto {
  @IsString()
  firstAttemptId: string;

  @IsString()
  secondAttemptId: string;
}
