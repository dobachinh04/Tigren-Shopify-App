import { updateCustomerPoints, getOrder } from "../api/shopify/shopify";

async function handleOrderPaid(payload) {
  const { customer_id, total_price } = payload.order;
  const points = Math.floor(total_price / 10);
  await updateCustomerPoints(customer_id, points);
}

async function handleOrderFulfilled(payload) {
  const { id, customer_id } = payload.order;
  const order = await getOrder(id);

  if (!order || !order.order) {
    console.error("Invalid order data");
    return;
  }

  if (order.order.fulfillment_status === "fulfilled") {
    const points = Math.floor(order.order.total_price / 10);
    await updateCustomerPoints(customer_id, points);
  }
}

// routes/webhooks.jsx

export const loader = async ({ request }) => {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    // Đọc request body chính xác
    const payload = await request.json();
    console.log("Payload nhận được:", payload);

    const url = new URL(request.url);
    if (url.pathname === "/webhooks/orders/fulfilled") {
      const { id, customer_id } = payload.order;

      console.log(`Order ID: ${id}, Customer ID: ${customer_id}`);
      return new Response("Order fulfilled webhook processed", { status: 200 });
    }
  } catch (error) {
    console.error("Lỗi xử lý webhook:", error);
    return new Response("Error processing webhook", { status: 500 });
  }
};
