import { IsEnum, IsOptional, IsString } from 'class-validator';

import { H2hSide } from '../../generated/prisma/client';

export class WithdrawDto {
  /** The side whose competitor withdraws */
  @IsEnum(H2hSide)
  side: H2hSide;

  @IsOptional()
  @IsString()
  comment?: string;
}
