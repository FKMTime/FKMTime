import { Role } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class JwtAuthDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsEnum(Role)
  role: Role;
}
