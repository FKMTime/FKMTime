import { INestApplication } from '@nestjs/common';

/**
 * Binds the test server to 127.0.0.1 up front. Supertest otherwise listens on
 * the wildcard address for every request, and on a machine where another
 * process already holds 127.0.0.1 on the same ephemeral port, requests reach
 * that process instead of the app under test.
 */
export const listenOnLoopback = async (app: INestApplication) => {
  await app.listen(0, '127.0.0.1');
};
