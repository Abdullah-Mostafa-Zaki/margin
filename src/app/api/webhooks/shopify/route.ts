import crypto from "crypto"; // Standard Node.js crypto
import { NextResponse } from "next/server"; // Next.js specific responses
import prisma from "@/lib/prisma"; // Your Prisma client

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

  if (!organization || !organization.shopifyWebhookSecret) {
    return NextResponse.json({ error: "Organization or Secret not found" }, { status: 404 });
  }

  // Read raw body for HMAC verification
  const rawBody = await req.text();

  // Verify HMAC signature
  const shopifyHmac = req.headers.get("x-shopify-hmac-sha256");
  const computedHmac = crypto
    .createHmac("sha256", organization.shopifyWebhookSecret)
    .update(rawBody, "utf8")
    .digest("base64");

  if (computedHmac !== shopifyHmac) {
    return NextResponse.json({ error: "Invalid HMAC signature" }, { status: 401 });
  }

  // Unified Payload Type
  const payload = JSON.parse(rawBody) as {
    name: string;
    total_price: string;
    gateway: string | null;
    payment_gateway_names?: string[];
    financial_status?: string;
  };

  // Logic for Egyptian Market (Manual/Draft = COD)
  const gateway = (payload.gateway || "").toLowerCase();
  const gatewayNames = (payload.payment_gateway_names || []).map((g: string) => g.toLowerCase());

  const isCod =
    gateway === "manual" ||
    gateway.includes("cod") ||
    gateway.includes("cash") ||
    gatewayNames.includes("manual") ||
    payload.financial_status === "pending";

  const paymentMethod = isCod ? "COD" : "CARD";
  const status = isCod ? "PENDING" : "RECEIVED";

  // Find the first ADMIN to use as creator
  const adminMembership = await prisma.membership.findFirst({
    where: { organizationId: organization.id, role: "ADMIN" },
    select: { userId: true },
  });

  if (!adminMembership) {
    return NextResponse.json({ error: "No admin found" }, { status: 500 });
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