const crypto = require('crypto');

const payload = JSON.stringify({
  id: 12345,
  name: "Order Test",
  items: [
    {
      product_id: 67890,
      quantity: 2
    }
  ]
});

const SHOPIFY_SECRET = '459a1eb3fff01f2eaa7fd1e5d446c1cd';

const calculatedHMAC = crypto
  .createHmac('sha256', SHOPIFY_SECRET)
  .update(payload, 'utf8')
  .digest('base64');

console.log('Calculated HMAC:', calculatedHMAC);
