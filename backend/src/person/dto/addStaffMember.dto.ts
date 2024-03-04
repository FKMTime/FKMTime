import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class AddStaffMemberDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  gender: string;
}
