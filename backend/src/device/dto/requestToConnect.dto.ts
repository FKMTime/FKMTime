import { IsEnum, IsInt } from 'class-validator';

//eslint-disable-next-line
enum DeviceType {
  STATION = 'STATION',
  STAFF_ATTENDANCE = 'STAFF_ATTENDANCE',
}
export class RequestToConnectDto {
  @IsInt()
  espId: number;

  @IsInt()
  signKey: number;

  @IsEnum(DeviceType)
  type: DeviceType;
}
