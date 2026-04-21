import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";

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

    // ── 2. Event filtering — only process order creation events ─────────────
    const shopifyTopic = req.headers.get("x-shopify-topic");
    if (shopifyTopic && shopifyTopic !== "orders/create") {
      return new NextResponse("Ignored non-order event", { status: 200 });
    }

    // ── 3. Fetch Organization ───────────────────────────────────────────────
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

    // Derive transaction status from Shopify's financial_status (e.g. COD = "pending")
    const financialStatus = order.financial_status?.toLowerCase();
    const txStatus = financialStatus === "pending" ? "PENDING" : "RECEIVED";

    const ownerId = organization.memberships[0]?.userId;
    if (!ownerId) {
      return new NextResponse("Organization has no owner", { status: 400 });
    }

    const shopifyOrderId = order.id ? String(order.id) : undefined;

    // ── 6. Prevent duplicate webhook processing ─────────────────────────────
    if (shopifyOrderId) {
      const existingTx = await prisma.transaction.findUnique({
        where: { 
          shopifyOrderId_organizationId: { 
            shopifyOrderId, 
            organizationId: organization.id 
          } 
        },
      });
      if (existingTx) {
        return new NextResponse("OK", { status: 200 });
      }
    }

    // ── 7. Map the Shopify payment gateway to Margin's PaymentMethod enum ──
    const shopifyGateway: string | undefined =
      order.payment_gateway_names?.[0] || order.gateway;
    const paymentMethod = mapPaymentMethod(shopifyGateway);

    // ── 8. Log the Transaction ──────────────────────────────────────────────
    await prisma.transaction.create({
      data: {
        type: "INCOME",
        amount: Number(price),
        date: new Date(),
        category: "Shopify Sale",
        status: txStatus,
        paymentMethod,
        organizationId: organization.id,
        createdById: ownerId,
        shopifyOrderId,
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

    // ── 9. Respond 200 OK so Shopify knows we successfully received it ─────
    return new NextResponse("OK", { status: 200 });

  } catch (error) {
    console.error("Shopify Webhook Processing Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}