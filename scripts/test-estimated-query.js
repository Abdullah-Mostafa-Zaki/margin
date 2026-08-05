const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  let t = await prisma.transaction.findFirst({
    where: { dateConfidence: 'ESTIMATED' }
  });
  
  // Set date to OUTSIDE the estimated range to test the bug
  const oldDate = t.date;
  t = await prisma.transaction.update({
    where: { id: t.id },
    data: { date: new Date('2026-01-01T00:00:00Z') }
  });

  console.log('Sample ESTIMATED transaction with date outside range:', {
    id: t.id,
    date: t.date,
    start: t.estimatedRangeStart,
    end: t.estimatedRangeEnd
  });

  // Query using old broken logic
  const oldQuery = await prisma.transaction.count({
    where: {
      id: t.id,
      date: { gte: t.estimatedRangeStart, lte: t.estimatedRangeEnd },
      OR: [
        { dateConfidence: "CONFIRMED" },
        { 
          dateConfidence: "ESTIMATED",
          estimatedRangeStart: { gte: t.estimatedRangeStart },
          estimatedRangeEnd: { lte: t.estimatedRangeEnd },
        }
      ]
    }
  });
  console.log('Old Query matched count (date filter at top level):', oldQuery);

  // Query using new fixed logic
  const newQuery = await prisma.transaction.count({
    where: {
      id: t.id,
      OR: [
        { dateConfidence: "CONFIRMED", date: { gte: t.estimatedRangeStart, lte: t.estimatedRangeEnd } },
        { 
          dateConfidence: "ESTIMATED",
          estimatedRangeStart: { gte: t.estimatedRangeStart },
          estimatedRangeEnd: { lte: t.estimatedRangeEnd },
        }
      ]
    }
  });
  console.log('New Query matched count (date filter inside CONFIRMED):', newQuery);
  
  // Restore
  await prisma.transaction.update({
    where: { id: t.id },
    data: { date: oldDate }
  });
}
run().catch(console.error).finally(() => prisma.$disconnect());
