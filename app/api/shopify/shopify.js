// app/api/shopify/shopify.js

const SHOPIFY_API_URL = 'https://quickstart-9fa495fe.myshopify.com/admin/api/2023-07';
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY; // Lưu API key trong biến môi trường
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;

const fetchShopifyAPI = async (endpoint, method = 'GET', data = null) => {
  const options = {
      method,
      headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_API_KEY,
      },
  };
  if (data) options.body = JSON.stringify(data);

  const response = await fetch(`${SHOPIFY_API_URL}/${endpoint}`, options);

  if (!response.ok) {
      console.error(`API Error: ${response.status} - ${response.statusText}`);
      throw new Error(`Shopify API Error: ${response.statusText}`);
  }

  return response.json();
};


// Lấy thông tin khách hàng
export const getCustomer = async (customerId) => {
    return await fetchShopifyAPI(`customers/${customerId}.json`);
};

// Cập nhật điểm thưởng vào metafield của khách hàng với namespace 'custom' và key 'reward_points'
export const updateCustomerPoints = async (customerId, points) => {
  const metafieldData = {
      metafield: {
          namespace: 'custom', // Sử dụng namespace là 'custom'
          key: 'reward_points', // Sử dụng key là 'reward_points'
          value: points.toString(),
          type: 'number_integer',
      },
  };
  return await fetchShopifyAPI(`customers/${customerId}/metafields.json`, 'PUT', metafieldData); // Sử dụng PUT
};

// Lấy thông tin đơn hàng
export const getOrder = async (orderId) => {
    return await fetchShopifyAPI(`orders/${orderId}.json`);
};
