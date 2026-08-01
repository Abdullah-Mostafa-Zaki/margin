const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTest() {
  const org = await prisma.organization.findFirst({ include: { memberships: true } });
  
  // Create two transactions: one valid order, one non-order
  const t1 = await prisma.transaction.create({
    data: {
      organizationId: org.id,
      amount: 100,
      type: "INCOME",
      status: "RECEIVED",
      date: new Date(),
      category: "Sales Revenue",
      source: "MANUAL",
      paymentMethod: "CASH",
      createdById: org.memberships[0].userId,
    }
  });

  const t2 = await prisma.transaction.create({
    data: {
      organizationId: org.id,
      amount: 50,
      type: "INCOME",
      status: "RECEIVED",
      date: new Date(),
      category: "Supplier Refund",
      source: "MANUAL",
      paymentMethod: "CASH",
      createdById: org.memberships[0].userId,
    }
  });

  console.log("Created test transactions:", t1.id, t2.id);

  // Simulate OLD baseWhere (any INCOME)
  const oldBaseWhere = {
    organizationId: org.id,
    type: "INCOME",
    id: { in: [t1.id, t2.id] }
  };
  const oldCount = await prisma.transaction.count({ where: oldBaseWhere });

  // Simulate NEW baseWhere (INCOME + valid categories)
  const newBaseWhere = {
    organizationId: org.id,
    type: "INCOME",
    category: { in: ["Sales Revenue", "Pop-up/Bazaar Sales", "Wholesale/B2B"] },
    id: { in: [t1.id, t2.id] }
  };
  const newCount = await prisma.transaction.count({ where: newBaseWhere });

  console.log(`Order count before fix (any INCOME): ${oldCount}`);
  console.log(`Order count after fix (narrowed category): ${newCount}`);

  // Clean up
  await prisma.transaction.deleteMany({
    where: { id: { in: [t1.id, t2.id] } }
  });
}

runTest().catch(console.error).finally(() => prisma.$disconnect());
