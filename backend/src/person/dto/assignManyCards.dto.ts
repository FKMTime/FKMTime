import { IsArray, IsInt, IsString } from 'class-validator';

export class AssignManyCardsDto {
  @IsArray()
  persons: Person[];
}

class Person {
  @IsInt()
  id: string;

  @IsString()
  cardId: string;
}
