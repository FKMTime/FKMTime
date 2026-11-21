import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

import { PrismaClient, Role } from '../../src/generated/prisma/client';
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

export async function seedDb() {
  const adminPassword = await bcrypt.hash('admin', 12);
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      fullName: 'Admin',
      roles: [Role.ADMIN],
      password: adminPassword,
    },
  });

  console.log({ adminUser });
}
seedDb()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
