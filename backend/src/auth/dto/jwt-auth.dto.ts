import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class JwtAuthDto {
  @IsNotEmpty()
  @IsInt()
  userId: number;

  @IsString()
  role: 'ADMIN' | 'DELEGATE';
}
