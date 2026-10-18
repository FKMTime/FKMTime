import 'dotenv/config';

import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'ts-node prisma/seed/seed.ts',
  },
  datasource: {
    // Read lazily rather than with env(): `prisma generate` runs in the
    // Docker build where no DATABASE_URL is set.
    url: process.env.DATABASE_URL,
  },
});
