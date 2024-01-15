import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class UpdateSettingsDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  username: string;
}
