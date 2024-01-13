import { IsOptional, IsString } from 'class-validator';

export class UpdatePersonDto {
  @IsString()
  @IsOptional()
  cardId: string;
}
