import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  const misclassified = await prisma.transaction.findMany({
    where: {
      status: 'RETURNED',
      bostaState: { in: ['Delivered', 'Awaiting for Action'] }
    },
    select: {
      id: true,
      shopifyOrderId: true,
      status: true,
      fulfillmentStatus: true,
      bostaState: true,
      bostaTrackingNumber: true,
      organization: { select: { slug: true } }
    }
  });

  console.log(`Found ${misclassified.length} potentially misclassified RETURNED transactions.`);
  
  if (misclassified.length > 0) {
    console.log("Sample rows:");
    console.log(JSON.stringify(misclassified.slice(0, 5), null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
