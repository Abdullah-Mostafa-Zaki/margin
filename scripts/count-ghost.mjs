import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Counting transactions with status GHOST_REVENUE...');
  const count = await prisma.transaction.count({
    where: {
      status: 'GHOST_REVENUE'
    }
  });
  console.log(`\nCOUNT_RESULT: ${count}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
