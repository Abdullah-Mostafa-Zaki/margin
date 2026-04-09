import crypto from "crypto";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const orgSlug = searchParams.get("orgSlug");

  if (!orgSlug) return NextResponse.json({ error: "No orgSlug" }, { status: 400 });

  const organization = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true, shopifyWebhookSecret: true },
  });

  if (!organization?.shopifyWebhookSecret) {
    return NextResponse.json({ error: "Secret not found" }, { status: 404 });
  }

  const rawBody = await req.text();
  const shopifyHmac = req.headers.get("x-shopify-hmac-sha256");
  const computedHmac = crypto
    .createHmac("sha256", organization.shopifyWebhookSecret)
    .update(rawBody, "utf8")
    .digest("base64");

  if (computedHmac !== shopifyHmac) return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });

  const payload = JSON.parse(rawBody);

  // LOGS: Check these in Vercel to see exactly what's happening
  console.log(`Webhook Received: ${payload.name} | Status: ${payload.financial_status}`);

  // Robust Field Extraction
  const gateway = (payload.gateway || "").toLowerCase();
  const financialStatus = (payload.financial_status || "").toLowerCase();
  const gatewayNames = (payload.payment_gateway_names || []).map((g: any) => String(g).toLowerCase());

  // In Egypt, 'pending' or 'manual' is almost always COD
  const isCod =
    gateway === "manual" ||
    gateway.includes("cod") ||
    gatewayNames.includes("manual") ||
    financialStatus === "pending"; // This captures draft orders immediately

  const paymentMethod = isCod ? "COD" : "CARD";
  const status = financialStatus === "paid" ? "RECEIVED" : "PENDING";

  const admin = await prisma.membership.findFirst({
    where: { organizationId: organization.id, role: "ADMIN" },
  });

  if (!admin) return NextResponse.json({ error: "No admin" }, { status: 500 });

  try {
    // UPSERT: Match by the unique Shopify ID we added to the schema
    await prisma.transaction.upsert({
      where: { shopifyOrderId: String(payload.id) },
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
        createdById: admin.userId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Prisma Error:", error);
    return NextResponse.json({ error: "DB Error" }, { status: 500 });
  }
}