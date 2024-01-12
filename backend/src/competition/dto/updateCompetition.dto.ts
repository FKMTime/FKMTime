import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateCompetitionDto {
  @IsString()
  @IsNotEmpty()
  scoretakingToken: string;

  @IsOptional()
  @IsString()
  currentGroupId: string;
}
