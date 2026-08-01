import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const transactions = await prisma.transaction.findMany({
    where: {
      dropId: { not: null },
      drops: { none: {} }
    }
  });

  console.log('Found transactions with dropId but no TransactionDrop row:', transactions.length);

  let created = 0;
  for (const tx of transactions) {
    if (tx.dropId) {
      await prisma.transactionDrop.create({
        data: {
          transactionId: tx.id,
          dropId: tx.dropId
        }
      });
      created++;
    }
  }

  console.log('Successfully created TransactionDrop rows:', created);

  const remaining = await prisma.transaction.count({
    where: {
      dropId: { not: null },
      drops: { none: {} }
    }
  });

  console.log('Remaining unmigrated transactions:', remaining);
}

run()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
