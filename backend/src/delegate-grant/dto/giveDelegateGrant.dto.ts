import { DelegateGrantPermission } from '@prisma/client';
import { IsArray, IsEnum, IsString, Matches } from 'class-validator';
import { groupIdRegex } from 'src/constants';

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
