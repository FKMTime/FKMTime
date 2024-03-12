import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { DeviceType } from '@prisma/client';

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
