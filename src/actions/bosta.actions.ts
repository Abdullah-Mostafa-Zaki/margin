"use server";

import prisma from "@/lib/prisma";
import { revalidateTag } from "next/cache";

/**
 * Helper to ensure the Authorization header is correctly formatted.
 * Verified in X-Ray: Bosta v0/v2 endpoints require the "Bearer " prefix.
 */
const formatAuthHeader = (token: string) => {
  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
};

/**
 * Tests Bosta credentials without saving to the database.
 */
export async function testBostaCredentials(email: string, password: string) {
  try {
    const response = await fetch("https://app.bosta.co/api/v2/users/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) return { success: false, error: "Invalid Bosta credentials" };
    return { success: true };
  } catch (error) {
    return { success: false, error: "An error occurred connecting to Bosta." };
  }
}

/**
 * Connects a Bosta account and stores the initial tokens.
 */
export async function connectBostaAccount(email: string, password: string, orgId: string) {
  try {
    const response = await fetch("https://app.bosta.co/api/v2/users/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) return { success: false, error: "Invalid Bosta credentials" };

    const json = await response.json();
    const { token, refreshToken } = json.data;

    await prisma.bostaIntegration.upsert({
      where: { organizationId: orgId },
      update: { bostaEmail: email, token, refreshToken },
      create: { organizationId: orgId, bostaEmail: email, token, refreshToken }
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: "An error occurred connecting to Bosta." };
  }
}

/**
 * Refreshes the Bosta token using the v2 endpoint (Verified: image_39cab5.png).
 */
export async function refreshBostaToken(orgId: string) {
  const integration = await prisma.bostaIntegration.findUnique({ where: { organizationId: orgId } });
  if (!integration) throw new Error("No Bosta integration found");

  const response = await fetch("https://app.bosta.co/api/v2/users/refresh-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: integration.refreshToken })
  });

  if (!response.ok) throw new Error("Failed to refresh Bosta token");

  const json = await response.json();
  const { token, refreshToken } = json.data;

  await prisma.bostaIntegration.update({
    where: { organizationId: orgId },
    data: { token, refreshToken }
  });

  return token;
}

/**
 * Fetches real-time COD balances using v2 (Verified: image_39ca95.png).
 */
export async function getLivePendingEscrow(orgId: string) {
  try {
    const freshToken = await refreshBostaToken(orgId);

    const response = await fetch("https://app.bosta.co/api/v2/deliveries/analytics/total-deliveries", {
      method: "GET",
      headers: {
        "Authorization": formatAuthHeader(freshToken),
        "Content-Type": "application/json"
      },
      cache: "no-store"
    });

    if (!response.ok) return { collectedCOD: 0, expectedCOD: 0 };

    const json = await response.json();
    return {
      collectedCOD: json.data?.collectedCOD || 0,
      expectedCOD: json.data?.expectedCOD || 0
    };
  } catch (error) {
    return { collectedCOD: 0, expectedCOD: 0 };
  }
}

/**
 * Sync Engine: Matches Shopify IDs to Bosta References (Verified: image_39ca72.png).
 * Fixed: Explicitly handles Bearer prefix to avoid empty production syncs.
 */
export async function syncBostaDeliveries(organizationId: string) {
  try {
    const freshToken = await refreshBostaToken(organizationId);
    const authHeader = formatAuthHeader(freshToken);

    const pendingTransactions = await prisma.transaction.findMany({
      where: { organizationId, status: "PENDING", shopifyOrderId: { not: null } }
    });

    if (pendingTransactions.length === 0) return { processedCount: 0, failedCount: 0 };

    // Use v2 search endpoint as per Phase 2 spec
    const response = await fetch("https://app.bosta.co/api/v2/deliveries/search", {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({}),
      cache: "no-store"
    });

    if (!response.ok) return { processedCount: 0, failedCount: 0 };

    const json = await response.json();
    const deliveries = json.deliveries || json.data?.deliveries || json.data || [];

    let processedCount = 0;
    let failedCount = 0;

    for (const transaction of pendingTransactions) {
      const expectedSuffix = `#${transaction.shopifyOrderId}`;
      const bostaDelivery = deliveries.find((d: any) =>
        d.businessReference && String(d.businessReference).endsWith(expectedSuffix)
      );

      if (!bostaDelivery) continue;

      const stateCode = bostaDelivery.state?.code;
      const bostaStateValue = bostaDelivery.state?.value || "Processing";
      
      let newMarginStatus = transaction.status;
      let newFulfillmentStatus: "UNFULFILLED" | "SHIPPED" | "DELIVERED" | "RETURNED" = "SHIPPED";

      const updateData: any = {
        bostaTrackingNumber: String(bostaDelivery.trackingNumber),
        bostaState: bostaStateValue,
        bostaLastSyncedAt: new Date()
      };

      // RTO / Returned Flow (Ghost Revenue - Bucket 3)
      if ([46, 47, 101].includes(stateCode) || ["Returned", "Canceled", "Cancelled"].includes(bostaStateValue)) {
        newMarginStatus = "RETURNED";
        newFulfillmentStatus = "RETURNED";
        updateData.status = newMarginStatus;
        updateData.fulfillmentStatus = newFulfillmentStatus;
      } 
      // Delivered Flow (Realized Revenue - Bucket 1)
      else if (stateCode === 45 || bostaStateValue === "Delivered") {
        newMarginStatus = "RECEIVED";
        newFulfillmentStatus = "DELIVERED";
        updateData.status = newMarginStatus;
        updateData.fulfillmentStatus = newFulfillmentStatus;

        // Secondary call for exact shipmentFees
        try {
          const detailsResponse = await fetch(`https://app.bosta.co/api/v2/deliveries/business/${bostaDelivery.trackingNumber}`, {
            method: "GET",
            headers: {
              "Authorization": authHeader,
              "Content-Type": "application/json"
            },
            cache: "no-store"
          });
          
          if (detailsResponse.ok) {
            const detailsJson = await detailsResponse.json();
            const deliveryData = detailsJson.data || detailsJson;
            const shipmentFee = deliveryData.shipmentFees || 0;
            
            // Deduct shipmentFees from the Shopify order total and lock into Bucket 1
            const currentAmount = Number(transaction.amount);
            updateData.amount = currentAmount - Number(shipmentFee);
            updateData.shipmentFee = Number(shipmentFee);
          }
        } catch (detailError) {
          console.error(`Bosta detail fetch error for ${bostaDelivery.trackingNumber}:`, detailError);
        }
      } else {
        updateData.status = newMarginStatus;
        updateData.fulfillmentStatus = newFulfillmentStatus;
      }

      try {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: updateData
        });
        processedCount++;

        // Remove the old sibling expense if it exists (reverting Phase 3 logic)
        try {
          const expenseId = `${transaction.shopifyOrderId}-shipping`;
          await prisma.transaction.deleteMany({
            where: {
              shopifyOrderId: expenseId,
              organizationId
            }
          });
        } catch (e) {
          // Ignore if it doesn't exist
        }
      } catch (innerError) {
        console.error(`Bosta Sync Error updating transaction ${transaction.id}:`, innerError);
        failedCount++;
        continue;
      }
    }

    if (processedCount > 0) {
      revalidateTag(`org-${organizationId}-transactions`, 'default');
    }

    return { processedCount, failedCount };
  } catch (error) {
    console.error("Bosta Sync Error:", error);
    return { processedCount: 0, failedCount: 0 };
  }
}

/**
 * Disconnects a Bosta account by removing its integration record.
 */
export async function disconnectBostaAccount(orgId: string) {
  try {
    await prisma.bostaIntegration.delete({
      where: { organizationId: orgId }
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to disconnect Bosta account" };
  }
}