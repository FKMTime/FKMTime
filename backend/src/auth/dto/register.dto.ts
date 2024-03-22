import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

enum Role {
  ADMIN = 'ADMIN',
  DELEGATE = 'DELEGATE',
  STAFF = 'STAFF',
}

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsEnum(Role)
  role: Role;
}
