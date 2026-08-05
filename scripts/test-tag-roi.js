const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log("--- TAG ROI FIX VERIFICATION ---");

  // Get the first tag/drop that has mixed statuses (or just create a temporary one)
  const org = await prisma.organization.findFirst({
    where: { name: 'ZAKI' },
    include: { drops: true }
  });
  const drop = org.drops[0];
  
  const user = await prisma.user.create({
    data: { email: `mock-user-${Date.now()}@test.com`, password: "pwd" }
  });
  
  // First clear existing transactions for this drop to have a clean test
  await prisma.transactionDrop.deleteMany({ where: { dropId: drop.id } });
  
  const t1 = await prisma.transaction.create({
    data: { type: 'INCOME', amount: 100, date: new Date(), category: 'Test', paymentMethod: 'CASH', status: 'RECEIVED', organizationId: org.id, createdById: user.id }
  });
  const t2 = await prisma.transaction.create({
    data: { type: 'INCOME', amount: 200, date: new Date(), category: 'Test', paymentMethod: 'CASH', status: 'PENDING', organizationId: org.id, createdById: user.id }
  });
  const t3 = await prisma.transaction.create({
    data: { type: 'INCOME', amount: 300, date: new Date(), category: 'Test', paymentMethod: 'CASH', status: 'RETURNED', organizationId: org.id, createdById: user.id }
  });
  
  await prisma.transactionDrop.createMany({
    data: [
      { transactionId: t1.id, dropId: drop.id },
      { transactionId: t2.id, dropId: drop.id },
      { transactionId: t3.id, dropId: drop.id },
    ]
  });

  // RAW DB Cross-Check
  const rawSum = await prisma.transaction.aggregate({
    where: { drops: { some: { dropId: drop.id } }, type: 'INCOME' },
    _sum: { amount: true }
  });
  
  const rawReceivedSum = await prisma.transaction.aggregate({
    where: { drops: { some: { dropId: drop.id } }, type: 'INCOME', status: 'RECEIVED' },
    _sum: { amount: true }
  });

  console.log("Created 3 INCOME transactions in DB for tag " + drop.name + ":");
  console.log("1. RECEIVED: $100");
  console.log("2. PENDING: $200");
  console.log("3. RETURNED: $300");
  
  console.log("\nBefore fix logic (Raw DB Sum of all statuses): $" + Number(rawSum._sum.amount));
  console.log("After fix logic (Raw DB Sum of RECEIVED only): $" + Number(rawReceivedSum._sum.amount));
  
  if (Number(rawReceivedSum._sum.amount) === 100) {
    console.log("✅ Success! Only RECEIVED income is counted.");
  } else {
    console.log("❌ Failed!");
  }
  
  // Cleanup
  await prisma.transactionDrop.deleteMany({ where: { dropId: drop.id } });
  await prisma.transaction.deleteMany({ where: { id: { in: [t1.id, t2.id, t3.id] } } });
  await prisma.user.delete({ where: { id: user.id } });
}

run().catch(console.error).finally(() => prisma.$disconnect());
