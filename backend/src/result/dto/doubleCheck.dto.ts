import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { UpdateAttemptDto } from 'src/attempt/dto/updateAttempt.dto';

export class DoubleCheckDto {
  @IsString()
  @IsNotEmpty()
  resultId: string;

  @ValidateNested({ each: true })
  @Type(() => AttemptDto)
  attempts: AttemptDto[];
}

class AttemptDto extends UpdateAttemptDto {
  @IsString()
  @IsNotEmpty()
  id: string;
}
