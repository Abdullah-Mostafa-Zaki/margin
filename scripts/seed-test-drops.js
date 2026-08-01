const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const org = await prisma.organization.findFirst();
  if (!org) {
    console.error("No org found!");
    return;
  }

  // Cleanup old test drops
  await prisma.drop.deleteMany({
    where: {
      organizationId: org.id,
      name: { in: ["August Flash Sale", "Back to School"] }
    }
  });

  // Create overlapping drops
  // Drop 1: Aug 1 - Aug 15
  await prisma.drop.create({
    data: {
      name: "August Flash Sale",
      organizationId: org.id,
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-15"),
      status: "LIVE"
    }
  });

  // Drop 2: Aug 10 - Aug 31
  await prisma.drop.create({
    data: {
      name: "Back to School",
      organizationId: org.id,
      startDate: new Date("2026-08-10"),
      endDate: new Date("2026-08-31"),
      status: "LIVE"
    }
  });

  console.log("Successfully seeded two overlapping drops for organization:", org.slug);
}

run().catch(console.error).finally(() => prisma.$disconnect());
