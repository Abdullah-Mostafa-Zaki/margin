import crypto from 'crypto';

const SECRET = 'test-secret-123';
const ORG_SLUG = 'zaki';
const WEBHOOK_URL = `https://margin-eg.vercel.app/api/webhooks/shopify?orgSlug=${ORG_SLUG}`;

const fakeOrder = {
    id: 123456789,
    name: '#1001',
    total_price: '450.00',
    gateway: 'cash_on_delivery',
    financial_status: 'pending',
    created_at: new Date().toISOString(),
    line_items: [
        { title: 'Summer Drop T-Shirt', quantity: 2, price: '225.00' }
    ]
};

const body = JSON.stringify(fakeOrder);

const hmac = crypto
    .createHmac('sha256', SECRET)
    .update(body, 'utf8')
    .digest('base64');

const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-shopify-hmac-sha256': hmac,
    },
    body,
});

const result = await response.json();
console.log('Status:', response.status);
console.log('Response:', result);