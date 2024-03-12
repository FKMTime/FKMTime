import { IsInt } from 'class-validator';

export class CreateAttendaceDto {
  @IsInt()
  cardId: number;

  @IsInt()
  espId: number;
}
