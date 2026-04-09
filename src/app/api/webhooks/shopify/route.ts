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

  if (!organization?.shopifyWebhookSecret) return NextResponse.json({ error: "Secret not found" }, { status: 404 });

  const rawBody = await req.text();
  const shopifyHmac = req.headers.get("x-shopify-hmac-sha256");
  const computedHmac = crypto.createHmac("sha256", organization.shopifyWebhookSecret).update(rawBody, "utf8").digest("base64");

  if (computedHmac !== shopifyHmac) return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });

  const payload = JSON.parse(rawBody);

  // 1. THE ULTIMATE LOG: This will tell us EXACTLY what Shopify is sending for "Pending" orders
  console.log(`WEBHOOK DATA: Order ${payload.name} | Status: ${payload.financial_status} | Gateway: ${payload.gateway}`);

  // 2. Fallback Logic: If it's not 'paid', it's PENDING. No exceptions for now.
  const financialStatus = (payload.financial_status || "").toLowerCase();
  const isPaid = financialStatus === "paid";
  const status = isPaid ? "RECEIVED" : "PENDING";

  // Default to COD for any Egyptian order that isn't explicitly paid via Card already
  const paymentMethod = isPaid ? "CARD" : "COD";

  const admin = await prisma.membership.findFirst({
    where: { organizationId: organization.id, role: "ADMIN" },
  });

  if (!admin) return NextResponse.json({ error: "No admin" }, { status: 500 });

  try {
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
    console.error("UPSERT ERROR:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}