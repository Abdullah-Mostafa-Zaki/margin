const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTest() {
  const org = await prisma.organization.findFirst();
  const drop = await prisma.drop.findFirst({ where: { organizationId: org.id } });
  
  if (!drop) {
    console.log("No drops found for test.");
    return;
  }

  const tagId = drop.id;

  // Simulate old filter
  const oldFilter = {
    OR: [
      { dropId: tagId },
      { drops: { some: { dropId: tagId } } }
    ]
  };

  // Simulate new filter
  const newFilter = {
    drops: { some: { dropId: tagId } }
  };

  const oldResults = await prisma.transaction.count({
    where: { organizationId: org.id, ...oldFilter }
  });

  const newResults = await prisma.transaction.count({
    where: { organizationId: org.id, ...newFilter }
  });

  console.log(`Transactions matched by old scalar-OR filter: ${oldResults}`);
  console.log(`Transactions matched by new relation-only filter: ${newResults}`);
  console.log(`Match: ${oldResults === newResults}`);
}

runTest().catch(console.error).finally(() => prisma.$disconnect());
