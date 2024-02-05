import { IsArray, IsInt, IsString } from 'class-validator';

export class AssignManyCardsDto {
  @IsArray()
  persons: Person[];
}

class Person {
  @IsInt()
  id: number;

  @IsString()
  cardId: string;
}
