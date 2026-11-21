import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

import { Role } from '../../generated/prisma/client';

export class CreateUserDto {
  @IsString()
  @IsOptional()
  username: string;

  @IsString()
  @IsOptional()
  fullName: string;

  @IsString()
  @IsOptional()
  wcaId: string;

  @IsString()
  @IsOptional()
  password: string;

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
