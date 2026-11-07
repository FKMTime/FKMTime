import { IsEnum, IsInt, IsString } from 'class-validator';

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

  @IsString()
  hw: string;
}

/** A connect request waiting for approval. existingDevice is set when a device
 * already in the database asks again, e.g. after a reset gave it a new sign key */
export type DeviceRequest = RequestToConnectDto & {
  existingDevice?: { id: string; name: string };
};
