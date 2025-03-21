import { PrismaClient, Role } from '@prisma/client';
import { sha512 } from 'js-sha512';
const prisma = new PrismaClient();

export async function seedDb() {
  const adminPassword = sha512('admin');
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
