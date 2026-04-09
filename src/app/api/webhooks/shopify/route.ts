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

  const payload = JSON.parse(rawBody) as {
    name: string;
    total_price: string;
    gateway: string | null;
    payment_gateway_names?: string[];
    financial_status?: string;
  };

  const gateway = (payload.gateway || "").toLowerCase();
  const gatewayNames = (payload.payment_gateway_names || []).map((g: string) => g.toLowerCase());

  const isCod =
    gateway === "manual" ||
    gateway.includes("cod") ||
    gateway.includes("cash") ||
    gatewayNames.includes("manual");

  // Status Logic: Only 'paid' becomes RECEIVED. Everything else is PENDING.
  const isPaid = payload.financial_status === "paid";
  const status = isPaid ? "RECEIVED" : "PENDING";
  const paymentMethod = isCod ? "COD" : "CARD";

  const adminMembership = await prisma.membership.findFirst({
    where: { organizationId: organization.id, role: "ADMIN" },
    select: { userId: true },
  });

  if (!adminMembership) {
    return NextResponse.json({ error: "No admin found" }, { status: 500 });
  }

  const orderNote = `Shopify Order ${payload.name}`;

  // Check if this specific order already exists in our database
  const existingTransaction = await prisma.transaction.findFirst({
    where: {
      organizationId: organization.id,
      notes: orderNote,
    },
  });

  if (existingTransaction) {
    // UPDATE: If we found it, just update the status and amount
    await prisma.transaction.update({
      where: { id: existingTransaction.id },
      data: {
        status: status,
        amount: Number(payload.total_price),
        paymentMethod: paymentMethod,
      },
    });
  } else {
    // CREATE: If it doesn't exist, create it new
    await prisma.transaction.create({
      data: {
        type: "INCOME",
        amount: Number(payload.total_price),
        date: new Date(),
        category: "Sales Revenue",
        paymentMethod: paymentMethod,
        status: status,
        notes: orderNote,
        organizationId: organization.id,
        createdById: adminMembership.userId,
      },
    });
  }

  return NextResponse.json({ success: true });
}