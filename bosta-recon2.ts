import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

const formatAuthHeader = (token: string) => {
  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
};

async function checkOrg(orgSlug: string, isDetailed: boolean) {
  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    include: { bostaIntegration: true }
  });

  if (!org || !org.bostaIntegration) {
    return { error: `Org ${orgSlug} not found or no integration` };
  }

  const refreshResponse = await fetch("https://app.bosta.co/api/v2/users/refresh-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: org.bostaIntegration.refreshToken })
  });

  if (!refreshResponse.ok) {
    return { error: `Failed to refresh token for ${orgSlug}` };
  }

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

  if (!response.ok) {
    return { error: `Failed to fetch deliveries for ${orgSlug}` };
  }

  const deliveries = (await response.json()).data?.deliveries || [];
  
  const statusCounts: Record<string, number> = {};
  const unexpected4647 = [];
  const detailedHistory = [];
  
  for (const d of deliveries) {
    const code = d.state?.code;
    const value = d.state?.value;
    const key = `${code} - ${value}`;
    statusCounts[key] = (statusCounts[key] || 0) + 1;
    
    if (isDetailed) {
      if ((code === 46 || code === 47) && !["Returned", "Canceled", "Cancelled"].includes(value)) {
        unexpected4647.push({ trackingNumber: d.trackingNumber, code, value });
      }
      
      detailedHistory.push({
        trackingNumber: d.trackingNumber,
        stateCode: code,
        stateValue: value,
        history: d.stateHistory || []
      });
    }
  }

  let specificOrders: any = null;
  if (isDetailed) {
    const targetOrders = await prisma.transaction.findMany({
      where: {
        organizationId: org.id,
        shopifyOrderId: { in: ["4060", "4056"] }
      }
    });

    specificOrders = {};
    for (const tx of targetOrders) {
      // Find matching bosta delivery
      const d = deliveries.find((del: any) => del.businessReference && del.businessReference.endsWith(`#${tx.shopifyOrderId}`));
      if (d) {
        specificOrders[tx.shopifyOrderId!] = {
          trackingNumber: d.trackingNumber,
          bosta_stateCode: d.state?.code,
          bosta_stateValue: d.state?.value,
          bosta_lastChangeTimestamp: d.stateHistory?.[0]?.createdAt || d.updatedAt || 'Not found',
          margin_updatedAt: tx.updatedAt,
          margin_bostaLastSyncedAt: tx.bostaLastSyncedAt,
          margin_status: tx.status,
          margin_fulfillmentStatus: tx.fulfillmentStatus
        };
      }
    }
  }

  return { statusCounts, unexpected4647, detailedHistory, specificOrders };
}

async function main() {
  const result: any = {};
  
  // 1. JOVA Detailed Check
  console.log("Checking JOVA...");
  result.jova = await checkOrg('jova', true);
  
  // 2. Find other orgs with bosta integration
  const otherOrgs = await prisma.organization.findMany({
    where: { bostaIntegration: { isNot: null }, slug: { not: 'jova' } },
    take: 3,
    select: { slug: true }
  });
  
  for (const o of otherOrgs) {
    console.log(`Checking ${o.slug}...`);
    result[o.slug] = await checkOrg(o.slug, false);
  }

  fs.writeFileSync('bosta-recon2-result.json', JSON.stringify(result, null, 2));
  console.log("Done. Results written to bosta-recon2-result.json");
}

main().catch(console.error).finally(() => prisma.$disconnect());
