import { NestExpressApplication } from '@nestjs/platform-express';

/**
 * In production the backend is reachable only through nginx, which appends
 * the client's address to X-Forwarded-For. Trusting exactly that one hop
 * makes req.ip the client's address rather than nginx's, so per-client rate
 * limits count each person separately. Trusting more hops would let a client
 * pick its own address by sending the header itself.
 */
export const trustNginxProxy = (app: NestExpressApplication) => {
  app.set('trust proxy', 1);
};
