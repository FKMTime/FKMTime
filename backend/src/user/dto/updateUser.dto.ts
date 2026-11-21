import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

import { Role } from '../../generated/prisma/client';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  username: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsArray()
  roles: Role[];

  /** A stage lead takes attendance in every room (SPEC-016) */
  @IsBoolean()
  @IsOptional()
  stageLeadAllRooms?: boolean;

  /** Or only in these rooms */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  stageLeadRoomIds?: string[];
}
