import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

import { DeviceType, HardwareVersion } from '../../generated/prisma/client';

export class DeviceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  espId: number;

  @IsInt()
  @IsOptional()
  signKey?: number;

  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsEnum(DeviceType)
  type: DeviceType;

  @IsEnum(HardwareVersion)
  hwVersion: HardwareVersion;
}
