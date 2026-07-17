import { DeviceType, HardwareVersion } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class DeviceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  espId: number;

  /** 64-char hex encoding of a 256-bit device secret */
  @IsString()
  @IsOptional()
  signKey?: string;

  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsEnum(DeviceType)
  type: DeviceType;

  @IsEnum(HardwareVersion)
  hwVersion: HardwareVersion;
}
