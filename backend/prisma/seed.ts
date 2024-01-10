import { PrismaClient } from '@prisma/client';
import { sha512 } from 'js-sha512';
const prisma = new PrismaClient();

async function main() {
  const adminPassword = sha512('admin');
  const adminUser = await prisma.account.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      email: 'admin@mailinator.com',
      username: 'admin',
      role: 'ADMIN',
      password: adminPassword,
    },
  });

  console.log({ adminUser });
}
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
