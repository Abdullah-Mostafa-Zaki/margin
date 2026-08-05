const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const count = await prisma.transaction.count({
    where: { dateConfidence: 'ESTIMATED' }
  });
  console.log('ESTIMATED count:', count);
}
run().catch(console.error).finally(() => prisma.$disconnect());
