import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import { ValidationPipe } from '@nestjs/common';
import * as passport from 'passport';

dotenv.config();

import { PrismaClient } from '@prisma/client';
import { sha512 } from 'js-sha512';

async function seedDb() {
  const prisma = new PrismaClient();

  try {
    const existingData = await prisma.account.findMany();

    if (existingData.length === 0) {
      console.log('Seeding database...');
      const adminPassword = sha512('admin');
      await prisma.account.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
          username: 'admin',
          role: 'ADMIN',
          password: adminPassword,
        },
      });
    } else {
      console.log('Database already seeded');
    }
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

const { PORT = 5000 } = process.env;
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await seedDb();
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
