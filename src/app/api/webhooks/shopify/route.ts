import crypto from "crypto";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const orgSlug = searchParams.get("orgSlug");

  if (!orgSlug) {
    return NextResponse.json({ error: "Missing orgSlug" }, { status: 400 });
  }

  // Find the organization and its webhook secret
  const organization = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true, shopifyWebhookSecret: true },
  });

  if (!organization) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  if (!organization.shopifyWebhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 401 });
  }

  // Read raw body before any parsing (required for HMAC verification)
  const rawBody = await req.text();

  // Verify HMAC signature from Shopify
  const shopifyHmac = req.headers.get("x-shopify-hmac-sha256");
  const computedHmac = crypto
    .createHmac("sha256", organization.shopifyWebhookSecret)
    .update(rawBody, "utf8")
    .digest("base64");

  if (computedHmac !== shopifyHmac) {
    return NextResponse.json({ error: "Invalid HMAC signature" }, { status: 401 });
  }

  // Parse the verified payload
  const payload = JSON.parse(rawBody) as {
    name: string;
    total_price: string;
    gateway: string;
  };

  // Determine payment method and status based on gateway
  const isCod = typeof payload.gateway === "string" &&
    (payload.gateway.toLowerCase().includes("cod") ||
      payload.gateway.toLowerCase().includes("cash_on_delivery"));

  const paymentMethod = isCod ? "COD" : "CARD";
  const status = isCod ? "PENDING" : "RECEIVED";

  // Find the first ADMIN membership to use as the creator
  const adminMembership = await prisma.membership.findFirst({
    where: {
      organizationId: organization.id,
      role: "ADMIN",
    },
    select: { userId: true },
  });

  if (!adminMembership) {
    return NextResponse.json({ error: "No admin found for organization" }, { status: 500 });
  }

  // Create the transaction
  await prisma.transaction.create({
    data: {
      type: "INCOME",
      amount: Number(payload.total_price),
      date: new Date(),
      category: "Sales Revenue",
      paymentMethod,
      status,
      notes: `Shopify Order ${payload.name}`,
      organizationId: organization.id,
      createdById: adminMembership.userId,
    },
  });

  return NextResponse.json({ success: true });
}
