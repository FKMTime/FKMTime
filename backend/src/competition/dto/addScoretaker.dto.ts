import { IsNotEmpty, IsString } from 'class-validator';

export class AddScoretakerDto {
  @IsString()
  @IsNotEmpty()
  wcaId: string;
}
