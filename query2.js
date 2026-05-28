const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const baseWhere = { paymentMethod: 'COD', type: 'INCOME' };
  
  const totalOrders = await prisma.transaction.count({
    where: baseWhere,
  });

  const shipped = await prisma.transaction.count({
    where: {
      ...baseWhere,
      OR: [
        { bostaTrackingNumber: { not: null } },
        { status: "RECEIVED" }
      ]
    },
  });

  const delivered = await prisma.transaction.count({
    where: {
      ...baseWhere,
      status: "RECEIVED",
    },
  });

  const returned = await prisma.transaction.count({
    where: {
      ...baseWhere,
      status: "RETURNED",
    },
  });

  console.log("=== NEW FUNNEL COUNTS ===");
  console.log(JSON.stringify({ totalOrders, shipped, delivered, returned }, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
