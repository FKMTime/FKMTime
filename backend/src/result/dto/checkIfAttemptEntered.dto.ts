import { IsNumber, IsString } from 'class-validator';

export class CheckIfAttemptEnteredDto {
  @IsString()
  sessionId: string;

  @IsNumber()
  espId: number;
}
