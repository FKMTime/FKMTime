import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { Role } from '../../generated/prisma/client';

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
