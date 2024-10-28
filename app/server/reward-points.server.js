// tigren-app/app/models/reward-points.server.js

import { apiVersion, authenticate } from "../shopify.server";

// Hàm lấy danh sách khách hàng
export async function fetchCustomerData(request) {
  const { session } = await authenticate.admin(request);
  const { shop, accessToken } = session;

  const query = `
  {
    customers(first: 10) {
      edges {
        node {
          id
          firstName
          lastName
          phone
          email
          addresses {
            country
          }
          orders(first: 10) {
            nodes {
              name
            }
          }
          amountSpent {
            amount
            currencyCode
          }
          metafield(namespace: "custom", key: "reward_points") {
            value
          }
        }
      }
    }
  }
  `;

  try {
    const response = await fetch(
      `https://${shop}/admin/api/${apiVersion}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({ query }),
      }
    );

    const result = await response.json();
    if (result.errors) {
      console.error("GraphQL Error:", result.errors);
      throw new Error(result.errors[0]?.message || "GraphQL query failed");
    }

    if (!result?.data?.customers) {
      throw new Error("No customers data found in response.");
    }

    return result.data.customers.edges.map(({ node }) => ({
      id: node.id,
      name: `${node.firstName ?? ""} ${node.lastName ?? ""}`.trim() || "N/A",
      email: node.email ?? "N/A",
      phone: node.phone ?? "N/A",
      address:
        node.addresses.map((addr) => `${addr.country}`).join("; ") || "N/A",
      orderCount: node.orders.nodes.length,
      amountSpent: `${node.amountSpent.amount} ${node.amountSpent.currencyCode}` ?? "N/A",
      points: parseInt(node.metafield?.value ?? 0, 10),
    }));
  } catch (error) {
    console.error("Error fetching customers:", error);
    throw new Response("Failed to load customers", { status: 500 });
  }
}

// Hàm cập nhật điểm thưởng cho khách hàng
export async function updateCustomerRewardPoints(request, customerId, points) {
  const { session } = await authenticate.admin(request);
  const { shop, accessToken } = session;

  const EDIT_REWARD_POINTS_MUTATION = `
    mutation updateCustomerRewardPoints($customerId: ID!, $points: String!) {
      customerUpdate(
        input: {
          id: $customerId
          metafields: [
            {
              namespace: "custom"
              key: "reward_points"
              value: $points
              type: "number_integer"
            }
          ]
        }
      ) {
        customer {
          id
          metafield(namespace: "custom", key: "reward_points") {
            value
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    const response = await fetch(
      `https://${shop}/admin/api/${apiVersion}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          query: EDIT_REWARD_POINTS_MUTATION,
          variables: {
            customerId,
            points: points.toString(), // Chuyển số thành chuỗi
          },
        }),
      }
    );

    const result = await response.json();
    if (result.errors || result.data.customerUpdate.userErrors.length > 0) {
      console.error("Error updating reward points:", result.errors);
      throw new Error(
        result.errors?.[0]?.message ||
        result.data.customerUpdate.userErrors[0]?.message ||
        "Failed to update reward points."
      );
    }

    return result.data.customer;
  } catch (error) {
    console.error("Error updating reward points:", error);
    throw new Response("Failed to update reward points", { status: 500 });
  }
}

