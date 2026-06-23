import crypto from 'crypto';

// CONFIGURATION
// Replace these with your actual local testing values
const ORG_SLUG = 'zaki';
const WEBHOOK_SECRET = 'your-shopify-webhook-secret'; // The secret in the Organization table
const ENDPOINT_URL = `http://localhost:3000/api/webhooks/shopify?orgSlug=${ORG_SLUG}`;

const dummyOrder = {
  id: Math.floor(Math.random() * 1000000),
  name: `#${Math.floor(1000 + Math.random() * 9000)}`,
  created_at: new Date().toISOString(), // Current date/time to fall into your newly created active Drop
  total_price: "150.00",
  financial_status: "paid",
  fulfillment_status: "unfulfilled",
  gateway: "cash on delivery", // Will be mapped to COD
  customer: {
    id: 987654321,
    first_name: "Test",
    last_name: "Customer"
  },
  shipping_address: {
    city: "Cairo"
  },
  line_items: [
    {
      name: "Summer Graphic Tee",
      quantity: 2,
      price: "75.00"
    }
  ]
};

const rawBody = JSON.stringify(dummyOrder);

// Generate the Shopify HMAC signature
const hmac = crypto
  .createHmac("sha256", WEBHOOK_SECRET)
  .update(rawBody, "utf8")
  .digest("base64");

console.log("🚀 Simulating Shopify Webhook (orders/create)...\n");
console.log(`Endpoint: ${ENDPOINT_URL}`);
console.log(`HMAC: ${hmac}\n`);

try {
  const response = await fetch(ENDPOINT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-shopify-topic': 'orders/create',
      'x-shopify-hmac-sha256': hmac,
    },
    body: rawBody
  });

  const responseText = await response.text();
  console.log(`Response Status: ${response.status}`);
  console.log(`Response Body: ${responseText}`);

  if (response.status === 200) {
    console.log("\n✅ Success! The webhook was received and processed.");
    console.log("Refresh your local Transactions list to see the new order auto-assigned to the active drop!");
  } else if (response.status === 401) {
    console.log("\n❌ Unauthorized. Make sure the WEBHOOK_SECRET in this script perfectly matches the `shopifyWebhookSecret` in your local database for this org.");
  } else {
    console.log("\n❌ Failed. Check your terminal running Next.js for server errors.");
  }
} catch (err) {
  console.error("Error sending webhook:", err);
}