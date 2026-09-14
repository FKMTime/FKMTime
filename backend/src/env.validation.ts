import { plainToInstance } from 'class-transformer';
import { IsString, MinLength, validateSync } from 'class-validator';

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
