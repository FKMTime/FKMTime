import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class NoteworthyIncidentDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description: string;
}
