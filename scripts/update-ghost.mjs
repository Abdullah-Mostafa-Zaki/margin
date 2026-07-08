import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Updating transactions with status GHOST_REVENUE to RETURNED...');
  // We use executeRawUnsafe to skip Prisma-level enum checks in case the schema is changing
  // But since the schema hasn't changed yet, we can also use Prisma's updateMany
  const updateResult = await prisma.transaction.updateMany({
    where: { status: 'GHOST_REVENUE' },
    data: { status: 'RETURNED' }
  });
  console.log(`\nUPDATE_RESULT: ${updateResult.count} rows updated.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
