import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DbService } from 'src/db/db.service';

import { AppModule } from '../../src/app.module';
import { loginWithFKMAccount } from './auth.helper';

export const createTestApp = async (): Promise<{
  app: INestApplication;
  db: DbService;
  adminToken: string;
}> => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();

  const db = moduleFixture.get<DbService>(DbService);
  const { token } = await loginWithFKMAccount(app, {
    username: 'admin',
    password: 'admin',
  });

  return { app, db, adminToken: token };
};
