import { IsNumber, IsOptional } from 'class-validator';

export class SetReplacementDto {
  @IsOptional()
  @IsNumber()
  replacedByExtraNumber: number | null;
}
