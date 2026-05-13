"use server";

import prisma from "@/lib/prisma";

/**
 * Connects a Bosta account and stores the initial tokens.
 * Uses v2 for the login handshake.
 */
export async function connectBostaAccount(email: string, password: string, orgId: string) {
  try {
    const response = await fetch("https://app.bosta.co/api/v2/users/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      return { success: false, error: "Invalid Bosta credentials" };
    }

    const json = await response.json();
    if (!json.success || !json.data?.token || !json.data?.refreshToken) {
      return { success: false, error: "Invalid Bosta credentials" };
    }

    const { token, refreshToken } = json.data;

    await prisma.bostaIntegration.upsert({
      where: { organizationId: orgId },
      update: {
        bostaEmail: email,
        token,
        refreshToken
      },
      create: {
        organizationId: orgId,
        bostaEmail: email,
        token,
        refreshToken
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Bosta connect error:", error);
    return { success: false, error: "An error occurred connecting to Bosta." };
  }
}

/**
 * Refreshes the Bosta token.
 * Note: Bosta tokens usually arrive with the "Bearer " prefix already attached.
 */
export async function refreshBostaToken(orgId: string) {
  const integration = await prisma.bostaIntegration.findUnique({
    where: { organizationId: orgId }
  });

  if (!integration) {
    throw new Error("No Bosta integration found for this organization");
  }

  const response = await fetch("https://app.bosta.co/api/v0/users/refresh-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: integration.refreshToken })
  });

  if (!response.ok) {
    throw new Error("Failed to refresh Bosta token");
  }

  const json = await response.json();
  if (!json.success || !json.data?.token || !json.data?.refreshToken) {
    throw new Error("Failed to refresh Bosta token");
  }

  const { token, refreshToken } = json.data;

  await prisma.bostaIntegration.update({
    where: { organizationId: orgId },
    data: {
      token,
      refreshToken
    }
  });

  return token;
}

/**
 * Fetches real-time escrow/COD balances.
 * Pivoted to v0 as v2 often rejects valid tokens with a 401.
 */
export async function getLivePendingEscrow(orgId: string) {
  try {
    const integration = await prisma.bostaIntegration.findUnique({
      where: { organizationId: orgId }
    });

    if (!integration) {
      return { collectedCOD: 0, expectedCOD: 0 };
    }

    const freshToken = await refreshBostaToken(orgId);

    // FIX: Removed 'Bearer ' prefix as freshToken already contains it.
    // Pivoted to v0 to avoid the 401/404 errors seen in v2.
    const response = await fetch("https://app.bosta.co/api/v0/deliveries/analytics/total-deliveries", {
      method: "GET",
      headers: {
        "Authorization": freshToken,
        "Content-Type": "application/json"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return { collectedCOD: 0, expectedCOD: 0 };
    }

    const json = await response.json();
    // v0 and v2 share similar structures, but we handle both for safety
    const analytics = json.data || json;

    return {
      collectedCOD: analytics.collectedCOD || 0,
      expectedCOD: analytics.expectedCOD || 0
    };
  } catch (error) {
    console.error("Live escrow fetch error:", error);
    return { collectedCOD: 0, expectedCOD: 0 };
  }
}

/**
 * Core Matching Engine.
 * Reconciles Shopify Orders with Bosta Deliveries using the suffix-matching logic.
 */
export async function syncBostaDeliveries(organizationId: string) {
  try {
    const freshToken = await refreshBostaToken(organizationId);

    const pendingTransactions = await prisma.transaction.findMany({
      where: {
        organizationId,
        status: "PENDING",
        shopifyOrderId: { not: null }
      }
    });

    if (pendingTransactions.length === 0) return 0;

    // FIX: URL is v0, limit is 500, and Bearer prefix is removed.
    const response = await fetch("https://app.bosta.co/api/v0/deliveries?limit=500", {
      method: "GET",
      headers: {
        "Authorization": freshToken,
        "Content-Type": "application/json"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      console.error(`Failed to fetch Bosta deliveries for org ${organizationId}`);
      return 0;
    }

    const json = await response.json();
    // Bosta v0 typically returns deliveries directly in the root or under a key
    const deliveries = json.deliveries || json.data?.deliveries || [];

    let processedCount = 0;

    for (const transaction of pendingTransactions) {
      if (!transaction.shopifyOrderId) continue;

      const expectedSuffix = `#${transaction.shopifyOrderId}`;

      const bostaDelivery = deliveries.find((d: any) =>
        d.businessReference && String(d.businessReference).endsWith(expectedSuffix)
      );

      if (!bostaDelivery) continue;

      const stateCode = bostaDelivery.state?.code;
      // Handle the various ways Bosta returns fees
      const shipmentFee = bostaDelivery.shipmentFees || bostaDelivery.wallet?.cashCycle?.shipping_fees || 0;

      if (stateCode === 45 || bostaDelivery.state?.value === "Delivered") {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: "RECEIVED",
            bostaTrackingNumber: String(bostaDelivery.trackingNumber),
            shipmentFee: Number(shipmentFee),
            bostaState: "Delivered",
            bostaLastSyncedAt: new Date()
          }
        });
        processedCount++;
      } else if (
        [46, 47, 101].includes(stateCode) ||
        ["Returned", "Canceled", "Cancelled", "Terminated", "Unreachable"].includes(bostaDelivery.state?.value)
      ) {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: "RETURNED",
            bostaTrackingNumber: String(bostaDelivery.trackingNumber),
            bostaState: bostaDelivery.state?.value || "Returned",
            bostaLastSyncedAt: new Date()
          }
        });
        processedCount++;
      }
    }

    return processedCount;
  } catch (error) {
    console.error(`Error syncing Bosta deliveries for org ${organizationId}:`, error);
    return 0;
  }
}