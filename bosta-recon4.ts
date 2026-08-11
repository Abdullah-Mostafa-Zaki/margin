import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const formatAuthHeader = (token: string) => {
  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
};

function getSimulatedUpdate(transaction: any, bostaDelivery: any) {
  const stateCode = bostaDelivery.state?.code;
  const bostaStateValue = bostaDelivery.state?.value || "Processing";
  
  let newMarginStatus = transaction.status;
  let newFulfillmentStatus = "SHIPPED";

  if (["Returned", "Canceled", "Cancelled"].includes(bostaStateValue)) {
    newMarginStatus = "RETURNED";
    newFulfillmentStatus = "RETURNED";
  } else if (bostaStateValue === "Delivered") {
    newMarginStatus = "RECEIVED";
    newFulfillmentStatus = "DELIVERED";
  } else if (bostaStateValue === "Awaiting for Action") {
    newMarginStatus = transaction.status;
    newFulfillmentStatus = "PROCESSING";
  } else {
    newMarginStatus = transaction.status;
    newFulfillmentStatus = "SHIPPED"; 
  }

  let oldMarginStatus = transaction.status;
  let oldFulfillmentStatus = "SHIPPED";
  if ([46, 47, 101].includes(stateCode) || ["Returned", "Canceled", "Cancelled"].includes(bostaStateValue)) {
    oldMarginStatus = "RETURNED";
    oldFulfillmentStatus = "RETURNED";
  } else if (stateCode === 45 || bostaStateValue === "Delivered") {
    oldMarginStatus = "RECEIVED";
    oldFulfillmentStatus = "DELIVERED";
  } else {
    oldMarginStatus = transaction.status;
    oldFulfillmentStatus = "SHIPPED";
  }

  return {
    trackingNumber: bostaDelivery.trackingNumber,
    stateCode: stateCode,
    stateValue: bostaStateValue,
    oldStatus: oldMarginStatus,
    oldFulfillment: oldFulfillmentStatus,
    newStatus: newMarginStatus,
    newFulfillment: newFulfillmentStatus,
    shopifyOrderId: transaction.shopifyOrderId
  };
}

async function runCheck(orgSlug: string) {
  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    include: { bostaIntegration: true }
  });

  if (!org || !org.bostaIntegration) return;

  const refreshResponse = await fetch("https://app.bosta.co/api/v2/users/refresh-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: org.bostaIntegration.refreshToken })
  });

  if (!refreshResponse.ok) return;

  const token = (await refreshResponse.json()).data.token;
  
  const response = await fetch("https://app.bosta.co/api/v2/deliveries/search", {
    method: "POST",
    headers: {
      "Authorization": formatAuthHeader(token),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({}),
    cache: "no-store"
  });

  if (!response.ok) return;

  const deliveries = (await response.json()).data?.deliveries || [];

  const pendingTransactions = await prisma.transaction.findMany({
    where: { organizationId: org.id, status: "PENDING", shopifyOrderId: { not: null } }
  });

  const allPendingSimulations = [];
  const statusCounts: Record<string, number> = {};

  for (const transaction of pendingTransactions) {
    const expectedSuffix = `#${transaction.shopifyOrderId}`;
    const bostaDelivery = deliveries.find((d: any) =>
      d.businessReference && String(d.businessReference).endsWith(expectedSuffix)
    );

    if (!bostaDelivery) continue;

    const key = `${bostaDelivery.state?.code} - ${bostaDelivery.state?.value || "Processing"}`;
    statusCounts[key] = (statusCounts[key] || 0) + 1;

    allPendingSimulations.push(getSimulatedUpdate(transaction, bostaDelivery));
  }

  console.log(`\n=== VERIFICATION RESULTS FOR ${orgSlug} ===`);
  console.log(`Matched ${allPendingSimulations.length} PENDING transactions to live Bosta deliveries.`);
  console.log(`Live Status Distribution for these PENDING transactions:`);
  console.table(statusCounts);
  
  const changed = allPendingSimulations.filter(s => s.oldStatus !== s.newStatus || s.oldFulfillment !== s.newFulfillment);
  console.log(`\nBefore/After Changes (Old Logic vs New Logic): ${changed.length} transactions have different outcomes.`);
  if (changed.length > 0) {
    console.table(changed);
  } else {
    console.log("No transactions produced a different outcome (i.e. no misclassifications in current PENDING queue).");
  }
}

async function main() {
  await runCheck('jova');
  await runCheck('vague');
}

main().catch(console.error).finally(() => prisma.$disconnect());
