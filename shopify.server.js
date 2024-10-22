const GET_PRODUCTS_QUERY = `#graphql
  query getProducts($first: Int!) {
    products(first: $first) {
      edges {
        node {
          id
          title
          handle
          status
          variants(first: 5) {
            edges {
              node {
                id
                price
                sku
              }
            }
          }
        }
      }
    }
  }
`;

export const authenticate = async () => {
  const app = createApp({
    apiKey: process.env.SHOPIFY_API_KEY,
    shopOrigin: process.env.SHOPIFY_STORE_URL,
  });

  const fetch = authenticatedFetch(app);
  const response = await fetch(`https://${process.env.SHOPIFY_STORE_URL}/admin/api/2023-10/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,  // Thêm access token
    },
    body: JSON.stringify({ query: GET_PRODUCTS_QUERY, variables: { first: 10 } }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL error: ${response.statusText}`);
  }

  return response.json();
};
