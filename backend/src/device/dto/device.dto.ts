import { IsEnum, IsInt, IsNotEmpty, IsString } from 'class-validator';
import { DeviceType } from '@prisma/client';

export class DeviceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  espId: number;

  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsEnum(DeviceType)
  type: DeviceType;
}
