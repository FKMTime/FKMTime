import { IsNotEmpty, IsString } from 'class-validator';

export class ChangeCompetingGroupDto {
  @IsString()
  @IsNotEmpty()
  personId: string;

  @IsString()
  @IsNotEmpty()
  newGroupId: string;
}
