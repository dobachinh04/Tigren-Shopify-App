// app/api/shopify/registerWebhook.js

export const registerWebhook = async (topic, callbackUrl) => {
  const webhookData = {
      webhook: {
          topic,
          address: callbackUrl,
          format: 'json',
      },
  };
  return await fetchShopifyAPI('webhooks.json', 'POST', webhookData);
};
