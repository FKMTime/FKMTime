import { IsString } from 'class-validator';

export class ConnectIntegratedLiveDto {
  @IsString()
  code: string;

  @IsString()
  redirectUri: string;
}
