import { IsArray, IsInt, IsString } from 'class-validator';

export class RemoveNoShowsDto {
  @IsArray()
  @IsInt({ each: true })
  registrationIds: number[];
}

export class WithdrawDto {
  /** Exactly the WCA's next in line, or empty for nobody */
  @IsArray()
  @IsInt({ each: true })
  advancingIds: number[];
}

export class PlaceInGroupDto {
  @IsString()
  personId: string;

  @IsString()
  groupId: string;
}
