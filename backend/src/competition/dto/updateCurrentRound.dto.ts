import {
  IsArray,
  IsNotEmpty,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { groupIdRegex } from 'src/constants';

export class UpdateRoomsDto {
  @IsArray()
  @ValidateNested({ each: true })
  rooms: RoomDto[];
}

class RoomDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsArray()
  @IsString({ each: true })
  currentGroupIds: string[];
}
