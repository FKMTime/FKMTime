import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

import { StaffRole } from '../../generated/prisma/client';

export class SetNoShowDto {
  @IsString()
  @IsNotEmpty()
  personId: string;

  @IsArray()
  @IsString({ each: true })
  groupIds: string[];

  @IsBoolean()
  noShow: boolean;

  /** Tags the person's competitor rows; staffing otherwise */
  @IsOptional()
  @IsIn([StaffRole.COMPETITOR])
  role?: typeof StaffRole.COMPETITOR;
}
