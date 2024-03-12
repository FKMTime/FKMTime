import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class UpdateRoomsDto {
  @IsArray()
  rooms: RoomDto[];
}

class RoomDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  currentGroupId: string;
}
