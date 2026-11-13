import { IsInt } from 'class-validator';

export class AddCompetitorToRoundDto {
  @IsInt()
  registrationId: number;
}
