import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsString()
  @MinLength(32, { message: 'SECRET must be at least 32 characters' })
  SECRET: string;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  WCA_LIVE_API_ORIGIN: string;

  @IsString()
  WCA_ORIGIN: string;

  @IsString()
  WCA_CLIENT_ID: string;

  @IsString()
  WCA_CLIENT_SECRET: string;

  /** The connector's device log folder, mounted read-only (SPEC-009) */
  @IsOptional()
  @IsString()
  DEVICE_LOGS_DIR?: string;

  /** Where the backend writes its own log, for admins to read (SPEC-011) */
  @IsOptional()
  @IsString()
  BACKEND_LOGS_DIR?: string;

  /**
   * Turns the station tester on outside the dev stack; PR previews set it.
   * Only "true" turns it on, so anything but "true" or "false" is refused
   * rather than read as off.
   */
  @IsOptional()
  @IsIn(['true', 'false'])
  STATION_TESTER_ENABLED?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
