import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';

export class GiveExtrasDto {
  @IsString()
  resultId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  attemptIds: string[];

  @IsOptional()
  @IsString()
  comment?: string;

  @IsBoolean()
  useFreshSet: boolean;

  @IsBoolean()
  removeFromLive: boolean;
}
