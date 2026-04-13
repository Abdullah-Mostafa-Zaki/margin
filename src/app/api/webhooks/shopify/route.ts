import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    const { searchParams } = new URL(req.url);
    const orgSlug = searchParams.get("orgSlug");

    if (!orgSlug) {
      return new NextResponse("Missing orgSlug", { status: 400 });
    }

    // 1. Fetch Organization based on orgSlug
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

    // 2. Exact HMAC Verification
    const hmacHeader = req.headers.get("x-shopify-hmac-sha256");
    if (!hmacHeader) {
      return new NextResponse("Unauthorized - Missing HMAC header", { status: 401 });
    }

    const generatedHash = crypto
      .createHmac("sha256", organization.shopifyWebhookSecret.trim())
      .update(rawBody, "utf8")
      .digest("base64");

    console.log("=== WEBHOOK DIAGNOSTICS ===");
    console.log("1. Webhook triggered for slug:", orgSlug);
    console.log("2. Secret Key found in DB?", !!organization.shopifyWebhookSecret);
    console.log("3. Raw Body Length:", rawBody.length);
    console.log("4. Received HMAC:", hmacHeader);
    console.log("5. Calculated HMAC:", generatedHash);
    console.log("===========================");

    if (generatedHash !== hmacHeader) {
      return new NextResponse("Unauthorized - HMAC Invalid", { status: 401 });
    }

    // 3. Process the Order
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

    const shopifyOrderId = order.id ? String(order.id) : undefined;

    // Prevent duplicate webhook processing
    if (shopifyOrderId) {
      const existingTx = await prisma.transaction.findUnique({
        where: { shopifyOrderId },
      });
      if (existingTx) {
        return new NextResponse("OK", { status: 200 });
      }
    }

    // 4. Log the Transaction
    await prisma.transaction.create({
      data: {
        type: "INCOME",
        amount: Number(price),
        date: new Date(),
        category: "Shopify Sale",
        status: "RECEIVED",
        paymentMethod: "CARD", // Defaulting to CARD for Shopify
        organizationId: organization.id,
        createdById: ownerId,
        shopifyOrderId,
        notes: `Shopify Order ${order.name || "\x23" + order.order_number}`,
      },
    });

    // 5. Respond 200 OK so Shopify knows we successfully received it
    return new NextResponse("OK", { status: 200 });

  } catch (error) {
    console.error("Shopify Webhook Processing Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}