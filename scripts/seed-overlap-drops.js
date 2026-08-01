const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const org = await prisma.organization.findUnique({ where: { slug: 'zaki-m1e3' } });
  
  if (!org) {
    console.error("Org not found");
    return;
  }

  // Delete existing overlapping drops if they exist to allow clean rerun
  await prisma.drop.deleteMany({
    where: {
      organizationId: org.id,
      name: { in: ['Winter Sale', 'New Year Push'] }
    }
  });

  const drop1 = await prisma.drop.create({
    data: {
      organizationId: org.id,
      name: 'Winter Sale',
      startDate: new Date('2025-01-01T00:00:00Z'),
      endDate: new Date('2025-01-20T23:59:59Z')
    }
  });

  const drop2 = await prisma.drop.create({
    data: {
      organizationId: org.id,
      name: 'New Year Push',
      startDate: new Date('2025-01-10T00:00:00Z'),
      endDate: new Date('2025-02-05T23:59:59Z')
    }
  });

  console.log("=== Seed Output ===");
  console.log("Drop 1:", JSON.stringify({
    id: drop1.id,
    name: drop1.name,
    startDate: drop1.startDate,
    endDate: drop1.endDate
  }, null, 2));

  console.log("Drop 2:", JSON.stringify({
    id: drop2.id,
    name: drop2.name,
    startDate: drop2.startDate,
    endDate: drop2.endDate
  }, null, 2));

}

run().catch(console.error);
