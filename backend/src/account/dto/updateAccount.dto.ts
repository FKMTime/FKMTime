import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

enum Role {
  ADMIN = 'ADMIN',
  DELEGATE = 'DELEGATE',
}

export class UpdateAccountDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsEnum(Role)
  role: Role;
}
