import { DeviceType } from '@prisma/client';
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

  @IsInt()
  @IsOptional()
  signKey?: number;

  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsEnum(DeviceType)
  type: DeviceType;
}
