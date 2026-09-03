import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Starting backfill for hasShopifyConnected...');
  
  // 1. Find all organizations that have at least one Shopify transaction
  const orgs = await prisma.transaction.groupBy({
    by: ['organizationId'],
    where: { source: 'SHOPIFY' }
  });
  
  const orgIds = orgs.map(o => o.organizationId);
  console.log(`Found ${orgIds.length} organizations with Shopify activity.`);
  
  if (orgIds.length === 0) {
    console.log('No organizations to backfill.');
    return;
  }

  // 2. Update all those organizations
  const result = await prisma.organization.updateMany({
    where: { 
      id: { in: orgIds },
      hasShopifyConnected: false // Only update if not already true
    },
    data: { hasShopifyConnected: true }
  });
  
  console.log(`[BACKFILL_RESULT] Successfully updated ${result.count} organizations to hasShopifyConnected = true.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
