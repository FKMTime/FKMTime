import { IsString } from 'class-validator';

export class RestoreExtraGrantDto {
  @IsString()
  grantId: string;
}
