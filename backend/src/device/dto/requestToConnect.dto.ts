import { IsEnum, IsInt, IsString, Length, Matches } from 'class-validator';

//eslint-disable-next-line
enum DeviceType {
  STATION = 'STATION',
  STAFF_ATTENDANCE = 'STAFF_ATTENDANCE',
}
export class RequestToConnectDto {
  @IsInt()
  espId: number;

  /** 64-char hex encoding of a 256-bit device secret */
  @IsString()
  @Length(64, 64)
  @Matches(/^[0-9a-fA-F]{64}$/)
  signKey: string;

  @IsEnum(DeviceType)
  type: DeviceType;

  @IsString()
  hw: string;
}
