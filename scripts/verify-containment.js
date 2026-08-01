const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTest() {
  const org = await prisma.organization.findFirst({ include: { memberships: true } });
  
  const queryWindowStart = new Date("2026-07-10T00:00:00Z");
  const queryWindowEnd = new Date("2026-07-20T00:00:00Z");

  // Create 3 transactions:
  // 1. FULL CONTAINMENT (Start: 07-12, End: 07-15) -> Should be included
  const t1 = await prisma.transaction.create({
    data: {
      organizationId: org.id,
      amount: 100,
      type: "INCOME",
      status: "RECEIVED",
      date: new Date("2026-07-13T12:00:00Z"),
      dateConfidence: "ESTIMATED",
      estimatedRangeStart: new Date("2026-07-12T00:00:00Z"),
      estimatedRangeEnd: new Date("2026-07-15T00:00:00Z"),
      customerCity: "TestCity",
      category: "Sales Revenue",
      source: "MANUAL",
      paymentMethod: "CASH",
      createdById: org.memberships[0].userId,
    }
  });

  // 2. PARTIAL OVERLAP (Start: 07-05, End: 07-15) -> Should be excluded (midpoint is 07-10)
  const t2 = await prisma.transaction.create({
    data: {
      organizationId: org.id,
      amount: 200,
      type: "INCOME",
      status: "RECEIVED",
      date: new Date("2026-07-10T00:00:00Z"),
      dateConfidence: "ESTIMATED",
      estimatedRangeStart: new Date("2026-07-05T00:00:00Z"),
      estimatedRangeEnd: new Date("2026-07-15T00:00:00Z"),
      customerCity: "TestCity",
      category: "Sales Revenue",
      source: "MANUAL",
      paymentMethod: "CASH",
      createdById: org.memberships[0].userId,
    }
  });

  // 3. NO OVERLAP (Start: 07-25, End: 07-30) -> Should be excluded
  const t3 = await prisma.transaction.create({
    data: {
      organizationId: org.id,
      amount: 300,
      type: "INCOME",
      status: "RECEIVED",
      date: new Date("2026-07-27T00:00:00Z"),
      dateConfidence: "ESTIMATED",
      estimatedRangeStart: new Date("2026-07-25T00:00:00Z"),
      estimatedRangeEnd: new Date("2026-07-30T00:00:00Z"),
      customerCity: "TestCity",
      category: "Sales Revenue",
      source: "MANUAL",
      paymentMethod: "CASH",
      createdById: org.memberships[0].userId,
    }
  });

  console.log("Created test transactions:", t1.id, t2.id, t3.id);

  // Now simulate the query inside getReturnsByCity
  const dateFilter = {
    date: {
      gte: queryWindowStart,
      lte: queryWindowEnd,
    },
    OR: [
      { dateConfidence: "CONFIRMED" },
      { 
        dateConfidence: "ESTIMATED",
        estimatedRangeStart: { gte: queryWindowStart },
        estimatedRangeEnd: { lte: queryWindowEnd },
      }
    ]
  };

  const results = await prisma.transaction.findMany({
    where: {
      id: { in: [t1.id, t2.id, t3.id] },
      ...dateFilter,
    }
  });

  console.log("\nResults matched by containment logic:");
  console.log(results.map(r => ({ id: r.id, amount: Number(r.amount) })));

  // Clean up
  await prisma.transaction.deleteMany({
    where: { id: { in: [t1.id, t2.id, t3.id] } }
  });
}

runTest().catch(console.error).finally(() => prisma.$disconnect());
