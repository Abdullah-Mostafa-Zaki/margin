import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  console.log("Setting up test organization...");
  
  // Find or create an organization for testing
  let org = await prisma.organization.findFirst();

  if (!org) {
    console.error("Test org not found. Please ensure seed data exists.");
    process.exit(1);
  }

  // Set courierFee to 45
  await prisma.organization.update({
    where: { id: org.id },
    data: { courierFee: 45, shopifyWebhookSecret: "test-secret" }
  });
  console.log("Updated courierFee to 45");

  // Create fake payload
  const orderId = `test-order-${Date.now()}`;
  const payload = {
    id: Date.now(),
    name: `#TEST-${Date.now()}`,
    order_number: Date.now(),
    current_total_price: "1000.00", // 1000 EGP
    financial_status: "pending",
    gateway: "Cash on Delivery (COD)",
    created_at: new Date().toISOString(),
    customer: { id: 123 },
    shipping_address: { city: "Cairo" },
    line_items: [
      {
        title: "Test Product",
        price: "1000.00",
        quantity: 1,
      }
    ]
  };

  const rawBody = JSON.stringify(payload);
  const hmac = crypto
    .createHmac("sha256", "test-secret")
    .update(rawBody, "utf8")
    .digest("base64");

  console.log(`Sending webhook for order ${payload.name}...`);
  
  // Wait a moment for server to be fully ready
  await new Promise(r => setTimeout(r, 2000));

  const res = await fetch(`http://localhost:3000/api/webhooks/shopify?orgSlug=${org.slug}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-shopify-hmac-sha256": hmac,
      "x-shopify-topic": "orders/create",
      "x-shopify-shop-domain": "test.myshopify.com"
    },
    body: rawBody
  });

  console.log("Webhook response status:", res.status);
  const responseText = await res.text();
  console.log("Webhook response body:", responseText);

  // Verify DB
  const txs = await prisma.transaction.findMany({
    where: {
      organizationId: org.id,
      notes: { contains: payload.name }
    }
  });

  console.log("\nCreated Transactions:");
  txs.forEach(t => {
    console.log(`- Type: ${t.type}, Category: ${t.category}, Amount: ${t.amount}, Method: ${t.paymentMethod}`);
  });

  const incomeTx = txs.find(t => t.type === "INCOME");
  const expenseTx = txs.find(t => t.type === "EXPENSE");

  if (incomeTx && incomeTx.amount === 955) {
    console.log("✅ Income transaction amount correctly deducted (1000 - 45 = 955)");
  } else {
    console.log("❌ Income transaction amount incorrect:", incomeTx?.amount);
  }

  if (expenseTx && expenseTx.amount === 45 && expenseTx.category === "Logistics (Shipping)") {
    console.log("✅ Expense transaction correctly created with Logistics category");
  } else {
    console.log("❌ Expense transaction incorrect or missing");
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
