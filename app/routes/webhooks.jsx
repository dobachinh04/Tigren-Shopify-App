import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { topic, shop, session, payload } = await authenticate.webhook(request);

  switch (topic) {
    case "ORDERS_CREATE":
      // Đây là nơi bạn xử lý dữ liệu đơn hàng mới
      console.log("orders/create: ", payload);

      // Ví dụ: Lưu đơn hàng vào cơ sở dữ liệu
      await db.orders.create({
        data: {
          orderId: payload.id,
          shopDomain: shop,
          customerEmail: payload.email,
          totalPrice: payload.total_price,
        },
      });
      break;

    default:
      // Nếu có chủ đề không xử lý
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  // Trả về phản hồi 200 nếu xử lý thành công
  return new Response(null, { status: 200 });
};
