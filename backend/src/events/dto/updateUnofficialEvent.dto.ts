import { IsObject } from 'class-validator';

export class UpdateUnofficialEventDto {
  @IsObject()
  wcif: any;
}
