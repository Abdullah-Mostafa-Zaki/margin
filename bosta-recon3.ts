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

  // NEW LOGIC
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
    newFulfillmentStatus = "SHIPPED"; // default
  }

  // OLD LOGIC
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

  const changed = [];

  for (const transaction of pendingTransactions) {
    const expectedSuffix = `#${transaction.shopifyOrderId}`;
    const bostaDelivery = deliveries.find((d: any) =>
      d.businessReference && String(d.businessReference).endsWith(expectedSuffix)
    );

    if (!bostaDelivery) continue;

    const sim = getSimulatedUpdate(transaction, bostaDelivery);
    
    // Only collect if the new outcome differs from old outcome OR if it's one of the specific states we care about (46, 47)
    if (sim.oldStatus !== sim.newStatus || sim.oldFulfillment !== sim.newFulfillment || [46, 47].includes(sim.stateCode)) {
      changed.push(sim);
    }
  }

  if (changed.length > 0) {
    console.log(`\n=== IMPACTED ROWS FOR ${orgSlug} ===`);
    console.table(changed);
  }
}

async function main() {
  await runCheck('jova');
  await runCheck('vague');
}

main().catch(console.error).finally(() => prisma.$disconnect());
