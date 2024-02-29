import { IsString } from 'class-validator';

export class UpdatePersonDto {
  @IsString()
  cardId: string;
}
