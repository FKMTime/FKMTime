import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class MarkReplacedDto {
  /** Was here but someone else did the job, rather than didn't come */
  @IsBoolean()
  wasPresent: boolean;

  @IsString()
  @IsOptional()
  replacedById?: string;
}
