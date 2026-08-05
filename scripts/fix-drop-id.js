const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log("--- PART 2: Testing bulkAssignDrop ---");
  const org = await prisma.organization.findFirst({
    where: { name: 'ZAKI' },
    include: { drops: true }
  });

  if (org && org.drops.length > 0) {
    const drop = org.drops[0];
    
    // Create 2 test transactions
    const tx1 = await prisma.transaction.create({
      data: {
        type: 'INCOME',
        amount: 100,
        date: new Date(),
        category: 'Test',
        paymentMethod: 'CASH',
        organizationId: org.id,
        createdById: org.drops[0].organizationId, // Just need a valid string, but createdById needs a user. Let's just find a user.
      }
    }); // This might fail if createdById is invalid.
  }
}
run().catch(console.error).finally(() => prisma.$disconnect());
