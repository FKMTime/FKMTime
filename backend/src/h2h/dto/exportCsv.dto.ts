import { IsNotEmpty, IsString } from 'class-validator';

export class ExportCsvDto {
  /** Decrypts the scrambles for this request only; never stored or logged */
  @IsString()
  @IsNotEmpty()
  password: string;
}
