import { IsArray, IsOptional, IsString } from 'class-validator';

import { Role } from '../../generated/prisma/client';

export class CreateUserDto {
  @IsString()
  @IsOptional()
  username: string;

  @IsString()
  @IsOptional()
  fullName: string;

  @IsString()
  @IsOptional()
  wcaId: string;

  @IsString()
  @IsOptional()
  password: string;

  @IsArray()
  roles: Role[];
}
