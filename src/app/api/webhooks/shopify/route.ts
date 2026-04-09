import crypto from "crypto";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const orgSlug = searchParams.get("orgSlug");

  if (!orgSlug) {
    return NextResponse.json({ error: "Missing orgSlug" }, { status: 400 });
  }

  const organization = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true, shopifyWebhookSecret: true },
  });

  if (!organization || !organization.shopifyWebhookSecret) {
    return NextResponse.json({ error: "Organization or Secret not found" }, { status: 404 });
  }

  const rawBody = await req.text();
  const shopifyHmac = req.headers.get("x-shopify-hmac-sha256");
  const computedHmac = crypto
    .createHmac("sha256", organization.shopifyWebhookSecret)
    .update(rawBody, "utf8")
    .digest("base64");

  if (computedHmac !== shopifyHmac) {
    return NextResponse.json({ error: "Invalid HMAC signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  // 1. Robust Field Extraction
  // Draft orders often have null gateways, so we check financial_status as a fallback
  const gateway = (payload.gateway || "").toLowerCase();
  const gatewayNames = (payload.payment_gateway_names || []).map((g: any) => String(g).toLowerCase());
  const financialStatus = (payload.financial_status || "").toLowerCase();

  // 2. Logic for Egyptian Market (Capture Pending/Draft as COD)
  const isCod =
    gateway === "manual" ||
    gateway.includes("cod") ||
    gateway.includes("cash") ||
    gatewayNames.includes("manual") ||
    financialStatus === "pending"; // Captures Draft Orders immediately

  const paymentMethod = isCod ? "COD" : "CARD";
  const status = financialStatus === "paid" ? "RECEIVED" : "PENDING";

  const adminMembership = await prisma.membership.findFirst({
    where: { organizationId: organization.id, role: "ADMIN" },
    select: { userId: true },
  });

  if (!adminMembership) {
    return NextResponse.json({ error: "No admin found" }, { status: 500 });
  }

  // 3. THE UPSERT
  // We use String(payload.id) because Shopify IDs are massive 64-bit integers
  await prisma.transaction.upsert({
    where: {
      shopifyOrderId: String(payload.id),
    },
    update: {
      status: status,
      amount: Number(payload.total_price),
      paymentMethod: paymentMethod,
    },
    create: {
      shopifyOrderId: String(payload.id),
      type: "INCOME",
      amount: Number(payload.total_price),
      date: new Date(),
      category: "Sales Revenue",
      paymentMethod: paymentMethod,
      status: status,
      notes: `Shopify Order ${payload.name}`,
      organizationId: organization.id,
      createdById: adminMembership.userId,
    },
  });

  return NextResponse.json({ success: true });
}