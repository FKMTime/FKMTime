import { IsNotEmpty, IsString } from 'class-validator';

export class WarningDto {
  @IsString()
  @IsNotEmpty()
  description: string;
}
