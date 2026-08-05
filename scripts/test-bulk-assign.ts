const Module = require('module');
const originalRequire = Module.prototype.require;
let mockEmail = null;

Module.prototype.require = function(request) {
  if (request === 'next-auth') {
    return {
      getServerSession: async () => mockEmail ? { user: { email: mockEmail } } : null
    };
  }
  if (request === 'next/cache') {
    return {
      revalidatePath: () => {},
      revalidateTag: () => {},
      unstable_cache: (fn) => fn
    };
  }
  return originalRequire.apply(this, arguments);
};

import prisma from "../src/lib/prisma";

async function runTest() {
  console.log("=== PHASE 2: bulkAssignDrop VERIFICATION ===\n");

  const org = await prisma.organization.create({
    data: { name: "Bulk Drop Test Org", slug: "bulk-drop-test-" + Date.now() }
  });
  
  const drop = await prisma.drop.create({
    data: { name: "Test Drop", organizationId: org.id }
  });

  const memberEmail = `bulk-member-${Date.now()}@test.com`;
  mockEmail = memberEmail;
  const memberUser = await prisma.user.create({
    data: { email: memberEmail, password: "pwd" }
  });

  await prisma.membership.create({
    data: { userId: memberUser.id, organizationId: org.id, role: "MEMBER" }
  });

  const tx = await prisma.transaction.create({
    data: {
      type: "INCOME",
      amount: 150,
      date: new Date(),
      category: "Test",
      paymentMethod: "CASH",
      organizationId: org.id,
      createdById: memberUser.id
    }
  });

  // Now require the action after mocks
  const { bulkAssignDrop } = require("../src/actions/transactions.actions");
  
  console.log("Assigning drop via bulkAssignDrop...");
  await bulkAssignDrop([tx.id], drop.id, org.slug);
  
  console.log("Validating updates...");
  const updatedTx = await prisma.transaction.findUnique({
    where: { id: tx.id },
    include: { drops: true }
  });
  
  console.log("Transaction.dropId:", updatedTx?.dropId);
  console.log("Transaction.drops (TransactionDrop map):", updatedTx?.drops.map(d => d.dropId));
  
  if (updatedTx?.dropId === drop.id && updatedTx?.drops[0]?.dropId === drop.id) {
    console.log("✅ Match! Both dropId FK and TransactionDrop were updated.");
  } else {
    console.log("❌ Mismatch!");
  }
  
  // Cleanup test data
  await prisma.transactionDrop.deleteMany({ where: { transactionId: tx.id } });
  await prisma.transaction.delete({ where: { id: tx.id } });
  await prisma.drop.delete({ where: { id: drop.id } });
  await prisma.membership.deleteMany({ where: { organizationId: org.id } });
  await prisma.user.delete({ where: { id: memberUser.id } });
  await prisma.organization.delete({ where: { id: org.id } });
  
  console.log("\n=== RUNNING BACKFILL ===");
  const mismatched = await prisma.transaction.count({
    where: {
      drops: { some: {} },
      dropId: null,
      type: "INCOME"
    }
  });
  console.log(`Before Backfill: ${mismatched} INCOME transactions with drops mapped but dropId=null.`);
  
  const txToFix = await prisma.transaction.findMany({
    where: { drops: { some: {} }, dropId: null, type: "INCOME" },
    include: { drops: true }
  });
  
  let fixedCount = 0;
  for (const t of txToFix) {
    if (t.drops.length > 0) {
      await prisma.transaction.update({
        where: { id: t.id },
        data: { dropId: t.drops[0].dropId }
      });
      fixedCount++;
    }
  }
  
  const remaining = await prisma.transaction.count({
    where: {
      drops: { some: {} },
      dropId: null,
      type: "INCOME"
    }
  });
  console.log(`After Backfill: Fixed ${fixedCount} records.`);
  console.log(`Remaining mismatched records: ${remaining}`);
}

runTest().catch(console.error).finally(() => prisma.$disconnect());
