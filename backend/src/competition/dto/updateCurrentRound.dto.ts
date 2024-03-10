import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class UpdateCurrentRoundDto {
  @IsArray()
  rooms: RoundDto[];
}

class RoundDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  currentRoundId: string;
}
