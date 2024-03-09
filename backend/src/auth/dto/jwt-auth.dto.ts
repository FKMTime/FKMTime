import {IsIn, IsNotEmpty, IsString} from 'class-validator';

export class JwtAuthDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsString()
  @IsIn(['ADMIN', 'DELEGATE', 'STAFF'])
  role: 'ADMIN' | 'DELEGATE' | 'STAFF';
}
