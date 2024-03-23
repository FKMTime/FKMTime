import { IsInt } from 'class-validator';

export class RequestToConnectDto {
  @IsInt()
  espId: number;
}
