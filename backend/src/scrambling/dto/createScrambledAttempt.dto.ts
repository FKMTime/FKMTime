import { IsBoolean, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateScrambledAttemptDto {
  @IsString()
  @IsNotEmpty()
  personId: string;

  @IsString()
  @IsNotEmpty()
  scramblerId: string;

  @IsString()
  @IsNotEmpty()
  roundId: string;

  @IsNumber()
  attemptNumber: number;

  @IsBoolean()
  isExtra: boolean;
}
