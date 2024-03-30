import { IsEnum, IsInt } from 'class-validator';

enum DeviceType {
  STATION = 'STATION',
  STAFF_ATTENDANCE = 'STAFF_ATTENDANCE',
}
export class RequestToConnectDto {
  @IsInt()
  espId: number;

  @IsEnum(DeviceType)
  type: DeviceType;
}
