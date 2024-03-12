import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

enum DeviceType {
  STATION = 'STATION',
  ATTENDANCE = 'ATTENDANCE',
}

export class DeviceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  espId: string;

  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsEnum(DeviceType)
  type: DeviceType;
}
