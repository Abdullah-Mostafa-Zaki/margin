import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

const formatAuthHeader = (token: string) => {
  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
};

async function main() {
  console.log("Starting script...");
  const orgSlug = 'jova';
  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    include: { bostaIntegration: true }
  });

  if (!org) {
    console.error(`Org ${orgSlug} not found`);
    return;
  }
  if (!org.bostaIntegration) {
    console.error(`Org ${orgSlug} has no bostaIntegration`);
    return;
  }

  console.log("Found org. Refreshing token...");
  const refreshResponse = await fetch("https://app.bosta.co/api/v2/users/refresh-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: org.bostaIntegration.refreshToken })
  });

  if (!refreshResponse.ok) {
    console.error('Failed to refresh Bosta token', await refreshResponse.text());
    return;
  }

  const refreshJson = await refreshResponse.json();
  const token = refreshJson.data.token;
  const authHeader = formatAuthHeader(token);

  console.log("Token refreshed. Fetching deliveries...");
  const response = await fetch("https://app.bosta.co/api/v2/deliveries/search", {
    method: "POST",
    headers: {
      "Authorization": authHeader,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({}),
    cache: "no-store"
  });

  if (!response.ok) {
    console.error('Failed to fetch from Bosta search API', await response.text());
    return;
  }

  const json = await response.json();
  const deliveries = json.deliveries || json.data?.deliveries || json.data || [];
  
  console.log(`Fetched ${deliveries.length} deliveries. Computing counts...`);

  const statusCounts: Record<string, number> = {};
  for (const d of deliveries) {
    const code = d.state?.code;
    const value = d.state?.value;
    const key = `${code} - ${value}`;
    statusCounts[key] = (statusCounts[key] || 0) + 1;
  }

  console.log("Getting transactions...");
  const txs = await prisma.transaction.findMany({
    where: { organizationId: org.id, shopifyOrderId: { not: null } }
  });

  console.log(`Got ${txs.length} transactions. Matching...`);
  const mixedSample = [];
  const statusCountsSample = { PENDING: 0, RECEIVED: 0, RETURNED: 0 };
  
  for (const d of deliveries) {
    if (!d.businessReference) continue;
    
    let matchedTx = null;
    for (const tx of txs) {
      if (d.businessReference.endsWith(`#${tx.shopifyOrderId}`)) {
        matchedTx = tx;
        break;
      }
    }

    if (matchedTx) {
      const marginStatus = matchedTx.status;
      if (mixedSample.length < 20 || (statusCountsSample[marginStatus as keyof typeof statusCountsSample] || 0) < 6) {
        mixedSample.push({
          bosta_trackingNumber: d.trackingNumber,
          bosta_stateCode: d.state?.code,
          bosta_stateValue: d.state?.value,
          bosta_cod: d.cod,
          bosta_codStatus: d.codStatus,
          bosta_dropOffAddress: d.dropOffAddress?.city?.name,
          bosta_isConfirmedDelivery: d.isConfirmedDelivery,
          bosta_timestamps: { createdAt: d.createdAt, stateChangedAt: d.stateHistory?.[0]?.createdAt },
          margin_status: matchedTx.status,
          margin_fulfillmentStatus: matchedTx.fulfillmentStatus,
          shopifyOrderId: matchedTx.shopifyOrderId
        });
        statusCountsSample[marginStatus as keyof typeof statusCountsSample] = (statusCountsSample[marginStatus as keyof typeof statusCountsSample] || 0) + 1;
      }
    }
  }

  const result = {
    statusCounts,
    sample: mixedSample.slice(0, 20)
  };

  fs.writeFileSync('bosta-inspection-result.json', JSON.stringify(result, null, 2));
  console.log("Done. Results written to bosta-inspection-result.json");
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
