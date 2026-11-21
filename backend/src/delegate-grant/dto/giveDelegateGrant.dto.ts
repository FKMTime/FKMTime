import { IsArray, IsEnum, IsString, Matches } from 'class-validator';
import { groupIdRegex } from 'src/constants';

import { DelegateGrantPermission } from '../../generated/prisma/client';

export class GiveDelegateGrantDto {
  @IsString()
  userId: string;

  @IsString()
  @Matches(groupIdRegex)
  groupId: string;

  @IsArray()
  @IsEnum(DelegateGrantPermission, { each: true })
  permissions: DelegateGrantPermission[];
}
