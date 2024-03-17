import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class UpdateBatteryPercentageDto {
  @IsNotEmpty()
  @IsString()
  readonly espId: string;

  @IsInt()
  @Min(0)
  @Max(100)
  readonly batteryPercentage: number;
}
