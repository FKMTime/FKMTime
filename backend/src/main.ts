import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as dotenv from 'dotenv';
import { json } from 'express';
import * as passport from 'passport';

import { AppModule } from './app.module';
import { installBackendLogFile } from './logging/backendLogFile';
import { trustNginxProxy } from './trust-proxy';

dotenv.config();
// Before anything logs, so admins see the whole log in the panel (SPEC-011)
installBackendLogFile(process.env.BACKEND_LOGS_DIR);

const { PORT = 5000 } = process.env;
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  trustNginxProxy(app);
  app.use(passport.initialize());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.use(json({ limit: '5mb' }));
  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: [
      'Authorization',
      'X-Requested-With',
      'Content-Type',
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Credentials',
      'Origin',
    ],
    // So the panel can name a downloaded device log file (SPEC-009)
    exposedHeaders: ['Content-Disposition'],
  });
  await app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}...`);
  });
}

bootstrap();
