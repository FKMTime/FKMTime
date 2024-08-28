import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddPersonDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  gender: string;

  @IsString()
  @IsOptional()
  wcaId: string;

  @IsString()
  @IsOptional()
  countryIso2: string;

  @IsString()
  @IsOptional()
  cardId: string;

  @IsBoolean()
  canCompete: boolean;
}
