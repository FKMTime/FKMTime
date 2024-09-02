import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

export const loginWithFKMAccount = async (
  app: INestApplication,
  user: { username: string; password: string },
): Promise<{ token: string; userInfo: any }> => {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send(user)
    .expect(200);

  return response.body;
};
