import { IsString } from 'class-validator';

export class WcaLoginDto {
  @IsString()
  code: string;

  @IsString()
  redirectUri: string;
}
