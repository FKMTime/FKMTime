import { IsEnum, IsInt, IsNotEmpty, IsString } from 'class-validator';
import { StaffRole } from '@prisma/client';

export class MarkAsPresentDto {
  @IsString()
  @IsNotEmpty()
  groupId: string;

  @IsInt()
  registrantId: number;

  @IsEnum(StaffRole)
  role: StaffRole;
}
