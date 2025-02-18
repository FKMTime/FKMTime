import { Role } from '@prisma/client';
import { IsNotEmpty, IsString } from 'class-validator';

export class JwtAuthDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  roles: Role[];
}
