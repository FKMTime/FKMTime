import { StaffRole } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

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
