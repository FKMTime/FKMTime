import { ArrayUnique, IsArray, IsString } from 'class-validator';

export class UpdateSeedsDto {
  /** Competitors in seed order, seed 1 first; at most the bracket's size */
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  personIds: string[];
}
