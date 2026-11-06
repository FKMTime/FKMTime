import { IsBoolean } from 'class-validator';

export class SetLeftEarlyDto {
  @IsBoolean()
  leftEarly: boolean;
}
