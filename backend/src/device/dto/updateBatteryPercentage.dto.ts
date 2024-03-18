import { IsInt, Max, Min } from 'class-validator';

export class UpdateBatteryPercentageDto {
  @IsInt()
  espId: number;

  @IsInt()
  @Min(0)
  @Max(100)
  readonly batteryPercentage: number;
}
