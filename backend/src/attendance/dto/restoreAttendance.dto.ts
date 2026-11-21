import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

import { StaffActivityStatus } from '../../generated/prisma/client';

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
