import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- QUERY 1: SHIPPED but PENDING ---');
  const shippedButPendingCount = await prisma.transaction.count({
    where: {
      fulfillmentStatus: 'SHIPPED',
      status: 'PENDING',
      paymentMethod: 'COD'
    }
  });
  console.log(`Count: ${shippedButPendingCount}`);
  
  const shippedButPendingSample = await prisma.transaction.findMany({
    where: {
      fulfillmentStatus: 'SHIPPED',
      status: 'PENDING',
      paymentMethod: 'COD'
    },
    take: 5,
    select: {
      id: true,
      shopifyOrderId: true,
      date: true,
      bostaState: true,
      fulfillmentStatus: true,
      status: true
    }
  });
  console.log(JSON.stringify(shippedButPendingSample, null, 2));

  console.log('\n--- QUERY 2: BOSTA DELIVERED but PENDING ---');
  // Looking for orders where Bosta has confirmed delivery/collection 
  // but our payment_status never moved off PENDING
  const deliveredButPendingSample = await prisma.transaction.findMany({
    where: {
      bostaState: 'Delivered',
      status: 'PENDING',
      paymentMethod: 'COD'
    },
    take: 5,
    select: {
      id: true,
      shopifyOrderId: true,
      date: true,
      bostaState: true,
      fulfillmentStatus: true,
      status: true
    }
  });
  console.log(`Count of Delivered but PENDING: ${await prisma.transaction.count({
    where: { bostaState: 'Delivered', status: 'PENDING', paymentMethod: 'COD' }
  })}`);
  console.log(JSON.stringify(deliveredButPendingSample, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
