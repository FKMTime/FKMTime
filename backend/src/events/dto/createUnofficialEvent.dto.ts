import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class CreateUnofficialEventDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  // This is a bit of a hack, but it's the only way to do it with class-validator.
  @IsArray()
  rounds: any;
}
