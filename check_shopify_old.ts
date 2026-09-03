import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const shopifyOrgs = await prisma.transaction.groupBy({
    by: ['organizationId'],
    where: { source: 'SHOPIFY' }
  });
  
  console.log(`[OLD_QUERY_RESULT] Exactly ${shopifyOrgs.length} organizations have Shopify activity.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
