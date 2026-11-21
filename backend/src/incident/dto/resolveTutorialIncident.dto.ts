import { IsBoolean, IsIn, IsInt, IsOptional } from 'class-validator';

import { AttemptStatus } from '../../generated/prisma/client';

/** The delegate's answer to a tutorial delegate call (SPEC-012) */
export class ResolveTutorialIncidentDto {
  @IsInt()
  value: number;

  @IsInt()
  penalty: number;

  @IsIn([AttemptStatus.RESOLVED, AttemptStatus.EXTRA_GIVEN])
  status: AttemptStatus;

  @IsBoolean()
  @IsOptional()
  doNotRequireCards?: boolean;
}
