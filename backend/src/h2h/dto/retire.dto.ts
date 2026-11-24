import { IsEnum, IsString } from 'class-validator';

import { H2hSide } from '../../generated/prisma/client';

export class RetireDto {
  /** The side whose competitor can't go on */
  @IsEnum(H2hSide)
  side: H2hSide;

  /** Why: required, as it ends the match */
  @IsString()
  comment: string;
}
