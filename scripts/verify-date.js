const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const t = await prisma.transaction.findUnique({ where: { id: 'cmsagc2qu0001zd58tro84399' } });
  console.log('Transaction date:', t.date);
}
run().catch(console.error).finally(() => prisma.$disconnect());
