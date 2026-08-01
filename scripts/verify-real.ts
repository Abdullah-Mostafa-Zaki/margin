import { PrismaClient } from '@prisma/client';
import { fetchAdvancedReturnMetrics } from '../src/app/actions/getAdvancedReturnMetrics';
import { fetchDashboardInsights } from '../src/app/actions/getDashboardInsights';
import { startOfCairoMonth, endOfCairoMonth } from '../src/lib/date-utils';

const prisma = new PrismaClient();

async function runTest() {
  const org = await prisma.organization.findFirst({ include: { memberships: true } });
  if (!org) throw new Error("No org found");

  const authorId = org.memberships[0].userId;

  console.log("=== Testing Task A: Containment + OR-Overwrite (getAdvancedReturnMetrics) ===");
  const now = new Date();
  
  const t1 = await prisma.transaction.create({
    data: {
      organizationId: org.id,
      amount: 500,
      type: "INCOME",
      status: "RETURNED",
      date: new Date(now.getFullYear(), now.getMonth(), 15),
      dateConfidence: "ESTIMATED",
      estimatedRangeStart: new Date(now.getFullYear(), now.getMonth(), 10),
      estimatedRangeEnd: new Date(now.getFullYear(), now.getMonth(), 20),
      category: "Sales Revenue",
      source: "MANUAL",
      paymentMethod: "CASH",
      createdById: authorId,
    }
  });
  
  const t2 = await prisma.transaction.create({
    data: {
      organizationId: org.id,
      amount: 600,
      type: "INCOME",
      status: "RETURNED",
      date: new Date(now.getFullYear() - 1, now.getMonth(), 15),
      dateConfidence: "CONFIRMED",
      category: "Sales Revenue",
      source: "MANUAL",
      paymentMethod: "CASH",
      createdById: authorId,
    }
  });

  // Sum up ONLY the test transactions we just created
  const testIds = [t1.id, t2.id];
  const testTxs = await prisma.transaction.findMany({
    where: { id: { in: testIds } },
    select: { id: true, amount: true, date: true }
  });
  
  const advMetrics = await fetchAdvancedReturnMetrics(
    org.id, 
    startOfCairoMonth(now),
    endOfCairoMonth(now)
  );
  
  const totalReturned = advMetrics.trends.reduce((sum, t) => sum + Number(t.lostRevenue), 0);
  console.log(`Expected returned amount in trend (including orphans): ${500 + 500}`);
  console.log(`Actual returned amount in trend: ${totalReturned}`);
  console.log('Trends array:', JSON.stringify(advMetrics.trends, null, 2));

  console.log("\n=== Testing Task B: getDashboardInsights Order Definition ===");
  const insightsBefore = await fetchDashboardInsights(
    org.id,
    startOfCairoMonth(now),
    endOfCairoMonth(now)
  );
  
  const t3 = await prisma.transaction.create({
    data: {
      organizationId: org.id,
      amount: 300,
      type: "INCOME",
      status: "RECEIVED",
      date: new Date(now.getFullYear(), now.getMonth(), 15),
      dateConfidence: "CONFIRMED",
      category: "Pop-up/Bazaar Sales",
      source: "MANUAL",
      paymentMethod: "CASH",
      createdById: authorId,
    }
  });

  const insightsAfter = await fetchDashboardInsights(
    org.id,
    startOfCairoMonth(now),
    endOfCairoMonth(now)
  );
  
  console.log(`Total Orders Before: ${insightsBefore.totalOrders}`);
  console.log(`Total Orders After (with Pop-up/Bazaar Sales): ${insightsAfter.totalOrders}`);
  
  // Cleanup
  await prisma.transaction.deleteMany({
    where: { id: { in: [t1.id, t2.id, t3.id] } }
  });
}

runTest().catch(console.error).finally(() => prisma.$disconnect());
