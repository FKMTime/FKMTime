import { IsNotEmpty, IsString } from 'class-validator';

export class GetTokenDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}
