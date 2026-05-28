const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const txs = await prisma.transaction.findMany({
    where: { paymentMethod: 'COD', type: 'INCOME' },
    select: { status: true, bostaTrackingNumber: true }
  });
  
  const dist = {
    RECEIVED: 0,
    PENDING: 0,
    RETURNED: 0,
    HAS_TRACKING: 0,
    NO_TRACKING: 0
  };
  
  txs.forEach(t => {
    dist[t.status] = (dist[t.status] || 0) + 1;
    if (t.bostaTrackingNumber) {
      dist.HAS_TRACKING++;
    } else {
      dist.NO_TRACKING++;
    }
  });
  
  console.log("=== DB DISTRIBUTION ===");
  console.log(JSON.stringify(dist, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
