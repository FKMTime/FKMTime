import { IsInt, IsOptional } from 'class-validator';

export class UpdatePersonDto {
  @IsInt()
  @IsOptional()
  cardId: number;
}
