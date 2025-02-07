import { IsString } from 'class-validator';

export class UploadFirmwareDto {
  @IsString()
  fileName: string;

  @IsString()
  fileData: string;
}
