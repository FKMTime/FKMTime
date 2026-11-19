import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import * as request from 'supertest';

import { trustNginxProxy } from '../../trust-proxy';
import { AuthService } from '../auth.service';
import { LoginController } from './login.controller';

// In production nginx is the only thing in front of the backend. It appends
// the client's address to X-Forwarded-For, so these requests look like the
// ones it forwards from two people on the venue's network.
describe('LoginController rate limit behind nginx', () => {
  let app: NestExpressApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])],
      controllers: [LoginController],
      providers: [
        { provide: AuthService, useValue: { login: jest.fn(() => ({})) } },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    trustNginxProxy(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const loginFrom = (clientIp: string) =>
    request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Forwarded-For', clientIp)
      .send({ username: 'someone', password: 'secret' });

  it('counts each client separately', async () => {
    for (let i = 0; i < 5; i++) {
      await loginFrom('192.168.1.10').expect(200);
    }
    await loginFrom('192.168.1.10').expect(429);

    await loginFrom('192.168.1.11').expect(200);
  });

  it('ignores an address a client puts in the header itself', async () => {
    for (let i = 0; i < 5; i++) {
      await loginFrom('192.168.1.10').expect(200);
    }

    // nginx appends the real address, so a forged one only comes first
    await loginFrom('10.0.0.99, 192.168.1.10').expect(429);
  });
});
