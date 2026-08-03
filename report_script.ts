import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRawUnsafe<any[]>(`
    WITH shopify_incomes AS (
      SELECT 
        "organizationId",
        id,
        "shopifyOrderId",
        "bostaState",
        "fulfillmentStatus"
      FROM "Transaction"
      WHERE "type" = 'INCOME' AND "source" = 'SHOPIFY' AND "shopifyOrderId" IS NOT NULL
    ),
    shipping_expenses AS (
      SELECT 
        "organizationId",
        amount,
        REPLACE("shopifyOrderId", '-shipping', '') AS "baseOrderId"
      FROM "Transaction"
      WHERE "type" = 'EXPENSE' 
        AND "category" = 'Logistics (Shipping)'
        AND "shopifyOrderId" LIKE '%-shipping'
    ),
    matched AS (
      SELECT 
        i."organizationId",
        i.id AS income_id,
        i."bostaState",
        i."fulfillmentStatus",
        e.amount AS double_deducted_amount,
        CASE 
          WHEN i."bostaState" = 'Delivered' OR i."fulfillmentStatus" = 'DELIVERED' THEN 'A'
          ELSE 'B'
        END AS bucket
      FROM shopify_incomes i
      LEFT JOIN shipping_expenses e 
        ON i."organizationId" = e."organizationId" 
        AND i."shopifyOrderId" = e."baseOrderId"
    )
    SELECT 
      m."organizationId",
      o.slug,
      o.plan,
      COUNT(m.income_id) AS "incomeCount",
      COUNT(m.double_deducted_amount) AS "matchedExpenseCount",
      SUM(CASE WHEN m.bucket = 'A' AND m.double_deducted_amount IS NOT NULL THEN 1 ELSE 0 END) AS "bucketACount",
      SUM(CASE WHEN m.bucket = 'B' AND m.double_deducted_amount IS NOT NULL THEN 1 ELSE 0 END) AS "bucketBCount",
      SUM(CASE WHEN m.bucket = 'B' THEN m.double_deducted_amount ELSE 0 END) AS "bucketBSum"
    FROM matched m
    JOIN "Organization" o ON o.id = m."organizationId"
    GROUP BY m."organizationId", o.slug, o.plan
  `);

  let totalAffectedOrgs = 0;
  
  console.log("--- Organization Breakdown ---");
  const affectedDetails = [];

  for (const row of result) {
    const incomeCount = Number(row.incomeCount);
    if (incomeCount === 0) continue;

    const bucketBCount = Number(row.bucketBCount);
    const bucketBSum = Number(row.bucketBSum);

    if (bucketBCount > 0) {
      totalAffectedOrgs++;
      affectedDetails.push({
        orgSlug: row.slug,
        plan: row.plan,
        bucketBCount,
        bucketBSum
      });
    }

    console.log(`\nOrganization: ${row.slug} (Plan: ${row.plan})`);
    console.log(`1. Total SHOPIFY INCOME transactions: ${incomeCount}`);
    console.log(`2. Matched sibling shipping EXPENSE transactions: ${Number(row.matchedExpenseCount)}`);
    console.log(`3. a) Bucket A (Delivered, netted removed): ${Number(row.bucketACount)}`);
    console.log(`3. b) Bucket B (Pending/Other, still netted): ${bucketBCount}`);
    console.log(`4. Bucket B total double-deducted EGP to add back: ${bucketBSum}`);
  }

  console.log("\n--- Aggregate Report ---");
  console.log(`5. Total organizations affected (have rows in Bucket B): ${totalAffectedOrgs}`);
  for (const d of affectedDetails) {
    console.log(`   - Org: ${d.orgSlug} | Plan: ${d.plan} | Bucket B Count: ${d.bucketBCount} | Sum to add back: ${d.bucketBSum} EGP`);
  }

  const shipmentFeeRows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*) as count FROM "Transaction" WHERE "shipmentFee" IS NOT NULL AND "shipmentFee" > 0
  `);
  const shipmentFeeCount = shipmentFeeRows.length > 0 ? Number(shipmentFeeRows[0].count) : 0;
  console.log(`\n6. Total Transaction rows with shipmentFee IS NOT NULL and > 0: ${shipmentFeeCount}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
