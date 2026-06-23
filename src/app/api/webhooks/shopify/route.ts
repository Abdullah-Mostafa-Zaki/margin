import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from 'next/cache';
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { PLAN_LIMITS } from "@/lib/plans";

function canAccessFeature(plan: string, feature: keyof typeof PLAN_LIMITS["FREE"]) {
  return PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS][feature];
}
/**
 * Maps a Shopify payment gateway string to one of Margin's PaymentMethod enum values.
 * Handles common Egyptian payment methods (COD, InstaPay) with a CARD fallback.
 */
function mapPaymentMethod(
  gateway: string | undefined | null
): "CASH" | "CARD" | "INSTAPAY" | "COD" {
  if (!gateway || gateway.trim() === "") return "COD";
  const g = gateway.toLowerCase();
  if (g.includes("cash") || g.includes("cod") || g.includes("delivery") || g.includes("manual") || g.includes("custom")) {
    return "COD";
  }
  if (g.includes("instapay")) {
    return "INSTAPAY";
  }
  return "CARD";
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    // ── 1. Validate required query parameter ────────────────────────────────
    const { searchParams } = new URL(req.url);
    const orgSlug = searchParams.get("orgSlug");

    if (!orgSlug) {
      return new NextResponse("Missing orgSlug", { status: 400 });
    }

    // ── 2. Event filtering — process creation, updates, and cancellations ──
    const shopifyTopic = req.headers.get("x-shopify-topic");
    const allowedTopics = ["orders/create", "orders/updated", "orders/cancelled", "orders/partially_fulfilled", "refunds/create"];
    if (shopifyTopic && !allowedTopics.includes(shopifyTopic)) {
      return new NextResponse("Ignored non-order event", { status: 200 });
    }

    // ── 3. Fetch Organization ───────────────────────────────────────────────
    noStore();
    const organization = await prisma.organization.findUnique({
      where: { slug: orgSlug },
      include: {
        memberships: {
          orderBy: { createdAt: "asc" },
          take: 1, // Grab the first user (likely the creator/owner)
        },
      },
    });

    if (!organization || !organization.shopifyWebhookSecret) {
      return new NextResponse("Unauthorized - Organization or secret key not found", { status: 401 });
    }

    if (!canAccessFeature(organization.plan, 'shopifySync')) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // ── 4. HMAC-SHA256 verification (timing-safe) ───────────────────────────
    const hmacHeader = req.headers.get("x-shopify-hmac-sha256");
    if (!hmacHeader) {
      return new NextResponse("Unauthorized - Missing HMAC header", { status: 401 });
    }

    const generatedHash = crypto
      .createHmac("sha256", organization.shopifyWebhookSecret.trim())
      .update(rawBody, "utf8")
      .digest("base64");

    // Convert both to Buffers of equal length for constant-time comparison.
    // If lengths differ the comparison will safely return false.
    const generatedBuf = Buffer.from(generatedHash, "base64");
    const receivedBuf = Buffer.from(hmacHeader, "base64");

    if (
      generatedBuf.length !== receivedBuf.length ||
      !crypto.timingSafeEqual(generatedBuf, receivedBuf)
    ) {
      return new NextResponse("Unauthorized - HMAC Invalid", { status: 401 });
    }

    // ── 5. Parse the order payload ──────────────────────────────────────────
    let order;
    try {
      order = JSON.parse(rawBody);
    } catch {
      return new NextResponse("Invalid JSON body", { status: 400 });
    }

    const price = order.current_total_price || order.total_price;
    if (!price || isNaN(Number(price))) {
      // If there is no price, ack to Shopify so they stop sending it
      return new NextResponse("OK", { status: 200 });
    }

    const ownerId = organization.memberships[0]?.userId;
    if (!ownerId) {
      return new NextResponse("Organization has no owner", { status: 400 });
    }

    const shopifyOrderId = order.name ? String(order.name) : undefined;
    const normalizedOrderId = shopifyOrderId ? String(shopifyOrderId).replace(/^#/, "").trim().toLowerCase() : undefined;

    // ── 6. Map the Shopify payment gateway to Margin's PaymentMethod enum ──
    const shopifyGateway: string | undefined =
      order.payment_gateway_names?.[0] || order.gateway;
    const paymentMethod = mapPaymentMethod(shopifyGateway);

    // Derive transaction status
    const financialStatus = order.financial_status?.toLowerCase();
    let txStatus: "PENDING" | "RECEIVED" | "RETURNED" = financialStatus === "pending" ? "PENDING" : "RECEIVED";
    if (financialStatus === "refunded" || financialStatus === "voided" || order.cancelled_at) {
      txStatus = "RETURNED";
    } else if (paymentMethod === "COD") {
      // COD can be marked as RECEIVED later by Bosta sync or manually
      // but if Shopify says it's paid (e.g. they paid by card), it's RECEIVED.
      // Wait, if it's COD, it's PENDING until courier confirms.
      txStatus = "PENDING";
    }

    // Derive fulfillment status
    const fulfillmentStatusRaw = order.fulfillment_status?.toLowerCase();
    let fulfillmentStatus: "UNFULFILLED" | "SHIPPED" | "DELIVERED" | "RETURNED" = "UNFULFILLED";
    if (fulfillmentStatusRaw === "fulfilled" || fulfillmentStatusRaw === "partial") {
      fulfillmentStatus = "SHIPPED"; 
    } else if (fulfillmentStatusRaw === "restocked" || order.cancelled_at) {
      fulfillmentStatus = "RETURNED";
    }

    // ── 7. Auto-assign to an active Drop by date range ───────────────────────
    const orderDate = order.created_at ? new Date(order.created_at) : new Date();
    const activeDrop = await prisma.drop.findFirst({
      where: {
        organizationId: organization.id,
        startDate: { lte: orderDate },
        endDate: { gte: orderDate },
      },
    });

    console.log('Parsed Order Date:', orderDate);
    console.log('Found Drop:', activeDrop?.id || null);

    // ── 8. Upsert or Create the Transaction ─────────────────────────────
    if (normalizedOrderId) {
      const existingTx = await prisma.transaction.findUnique({
        where: { 
          shopifyOrderId_organizationId: { 
            shopifyOrderId: normalizedOrderId, 
            organizationId: organization.id 
          } 
        },
      });

      if (existingTx) {
        // Handle Updates / Partial Refunds
        const updateData: any = {
          amount: Number(price),
          status: txStatus !== existingTx.status && txStatus === "RETURNED" ? "RETURNED" : undefined,
          fulfillmentStatus: fulfillmentStatus !== "UNFULFILLED" ? fulfillmentStatus : undefined,
        };

        if (!existingTx.dropId && activeDrop) {
          updateData.dropId = activeDrop.id;
        }

        await prisma.transaction.update({
          where: { id: existingTx.id },
          data: updateData
        });
        return new NextResponse("OK", { status: 200 });
      }
    }

    // ── 9. Log the Transaction (Creation) ───────────────────────────────────
    await prisma.transaction.create({
      data: {
        type: "INCOME",
        amount: Number(price),
        date: orderDate,
        category: "Shopify Sale",
        status: txStatus,
        fulfillmentStatus,
        paymentMethod,
        organizationId: organization.id,
        createdById: ownerId,
        shopifyOrderId: normalizedOrderId,
        dropId: activeDrop ? activeDrop.id : undefined,
        customerCity: order.shipping_address?.city ?? null,
        customerId: order.customer?.id ? String(order.customer.id) : null,
        notes: `Shopify Order ${order.name || "\x23" + order.order_number}`,
        lineItems: {
          create: (order.line_items || []).map((item: any) => ({
            name: item.title || item.name || "Unknown Product",
            quantity: item.quantity || 1,
            price: Number(item.price || 0)
          }))
        }
      },
    });

    // ── 10. Respond 200 OK so Shopify knows we successfully received it ────
    return new NextResponse("OK", { status: 200 });

  } catch (error) {
    console.error("Shopify Webhook Processing Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}