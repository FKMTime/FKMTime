import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateNotificationToken {
  @IsString()
  @IsNotEmpty()
  token: string;
}
