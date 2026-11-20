import { Role } from '@prisma/client';
import { IsNotEmpty, IsString } from 'class-validator';

export class JwtAuthDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  roles: Role[];

  /** User.tokenVersion when the token was issued; absent on older tokens */
  tokenVersion?: number;

  /** Expiry of the token, in seconds since epoch (set when validated) */
  exp?: number;
}
