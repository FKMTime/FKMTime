import { StaffActivityStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class RestoreAttendanceDto {
  @IsEnum(StaffActivityStatus)
  status: StaffActivityStatus;

  @IsBoolean()
  leftEarly: boolean;

  @IsBoolean()
  noShow: boolean;

  @IsString()
  @IsOptional()
  replacedById?: string | null;
}
