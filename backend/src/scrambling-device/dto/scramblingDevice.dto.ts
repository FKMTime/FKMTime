import { IsNotEmpty, IsString } from 'class-validator';

export class ScramblingDeviceDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  roomId: string;
}
