import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class DeviceConnectedDto {
  @IsInt()
  espId: number;

  @IsString()
  @IsNotEmpty()
  firmwareVersion: string;
}
