import { IsBoolean } from 'class-validator';

export class SetTutorialDto {
  /** True starts tutorial mode on the station, false ends it (SPEC-012) */
  @IsBoolean()
  enabled: boolean;
}
