import { StaffRole } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class AddNotAssignedPersonDto {
  @IsString()
  @IsNotEmpty()
  personId: string;

  @IsEnum(StaffRole)
  role: StaffRole;
}
