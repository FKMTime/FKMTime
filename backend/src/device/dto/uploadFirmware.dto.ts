import { IsString, Matches } from 'class-validator';

export class UploadFirmwareDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]+\.bin$/, {
    message: 'fileName must be a plain .bin filename with no path components',
  })
  fileName: string;

  @IsString()
  fileData: string;
}
