import { Role } from '@prisma/client';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  username: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsArray()
  roles: Role[];
}
