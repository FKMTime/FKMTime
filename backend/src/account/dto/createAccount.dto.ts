import { Role } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsOptional()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsEnum(Role)
  role: Role;
}
