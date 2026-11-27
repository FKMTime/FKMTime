import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

class PlanRowEdit {
  @IsString()
  id: string;

  /** Null leaves the row without a set */
  @ValidateIf((row: PlanRowEdit) => row.scrambleSetId !== null)
  @IsString()
  scrambleSetId: string | null;
}

export class UpdateScramblePlanDto {
  /** Only the rows to change */
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique((row: PlanRowEdit) => row.id)
  @ValidateNested({ each: true })
  @Type(() => PlanRowEdit)
  rows: PlanRowEdit[];
}
