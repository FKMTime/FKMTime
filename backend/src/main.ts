import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as dotenv from 'dotenv';
import * as passport from 'passport';
import { AppModule } from './app.module';

dotenv.config();

const { PORT = 5000 } = process.env;
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(passport.initialize());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
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
  });
  await app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}...`);
  });
}

bootstrap();
