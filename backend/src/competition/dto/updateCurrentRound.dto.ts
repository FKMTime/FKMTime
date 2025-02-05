import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';

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
  currentGroupIds: string[];
}
