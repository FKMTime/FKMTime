import { IsNotEmpty, IsString } from 'class-validator';

export class UnlockScrambleSetDto {
  @IsString()
  @IsNotEmpty()
  password: string;
}
