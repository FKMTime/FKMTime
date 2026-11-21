import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

import { StaffRole } from '../../generated/prisma/client';

export class AddNotAssignedPersonDto {
  @IsString()
  @IsNotEmpty()
  personId: string;

  @IsEnum(StaffRole)
  role: StaffRole;
}
