import { IsIn, IsInt, IsNotEmpty, IsString } from 'class-validator';

export class JwtAuthDto {
  @IsNotEmpty()
  @IsInt()
  userId: number;

  @IsNotEmpty()
  @IsString()
  @IsIn(['ADMIN', 'DELEGATE'])
  role: 'ADMIN' | 'DELEGATE';
}
