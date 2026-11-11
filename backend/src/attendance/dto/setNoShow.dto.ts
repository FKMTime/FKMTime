import { IsArray, IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class SetNoShowDto {
  @IsString()
  @IsNotEmpty()
  personId: string;

  @IsArray()
  @IsString({ each: true })
  groupIds: string[];

  @IsBoolean()
  noShow: boolean;
}
