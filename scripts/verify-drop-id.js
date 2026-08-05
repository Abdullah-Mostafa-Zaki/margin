const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const mismatched = await prisma.transaction.count({
    where: {
      drops: { some: {} },
      dropId: null
    }
  });
  console.log('Total transactions assigned to drops but dropId is null:', mismatched);

  const orgs = await prisma.organization.findMany({
    where: { 
      drops: { some: { transactions: { some: {} } } } 
    },
    include: { drops: { where: { transactions: { some: {} } } } },
    take: 1
  });
  if (orgs.length > 0) {
    const org = orgs[0];
    console.log('\nSelected Org for Verification:', org.name, org.id);
    for (const drop of org.drops.slice(0, 3)) {
      const dropIdSum = await prisma.transaction.aggregate({
        where: { dropId: drop.id, type: 'INCOME' },
        _sum: { amount: true }
      });
      const transactionDropSum = await prisma.transaction.aggregate({
        where: { drops: { some: { dropId: drop.id } }, type: 'INCOME' },
        _sum: { amount: true }
      });
      console.log('Drop:', drop.name, drop.id);
      console.log('  Sum via dropId FK:', dropIdSum._sum.amount);
      console.log('  Sum via TransactionDrop:', transactionDropSum._sum.amount);
    }
  } else {
    console.log('No orgs with drops found.');
  }
}
run().catch(console.error).finally(() => prisma.$disconnect());
