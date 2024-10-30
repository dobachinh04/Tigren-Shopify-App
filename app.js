require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const crypto = require("crypto");
const axios = require("axios");
const fs = require("fs"); // Import module fs để thao tác với file
const crypto = require("crypto"); // Import module crypto để tính toán HMAC

const app = express();
const PORT = 3000;

// Sử dụng biến môi trường
const SHOPIFY_SECRET = process.env.SHOPIFY_SECRET;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOP_NAME = process.env.SHOP_NAME;


app.use(bodyParser.json());

// Hàm để xác minh chữ ký HMAC
function verifyHMAC(req) {
  const hmacHeader = req.get("X-Shopify-Hmac-Sha256"); // Lấy chữ ký HMAC từ header
  const payload = JSON.stringify(req.body); // Chuyển đổi payload thành chuỗi JSON

  // Tính toán HMAC từ payload
  const calculatedHMAC = crypto
    .createHmac("sha256", SHOPIFY_SECRET)
    .update(payload, "utf8")
    .digest("base64"); // Chuyển đổi HMAC thành base64

  // So sánh chữ ký HMAC
  return crypto.timingSafeEqual(
    Buffer.from(hmacHeader, "base64"),
    Buffer.from(calculatedHMAC, "base64"),
    Buffer.from(calculatedHMAC, "base64"),
  );
}

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// Webhook cho sự kiện tạo đơn hàng
app.post("/webhook/orders/create", (req, res) => {
  if (!verifyHMAC(req)) {
    // Ghi log trạng thái thất bại khi xác minh HMAC
    const logEntry = `HMAC verification failed at ${new Date().toISOString()}: Invalid HMAC signature!\n\n`;
    fs.appendFile("webhook-log.txt", logEntry, (err) => {
      if (err) {
        console.error("Failed to write to log file", err);
      } else {
        console.log("HMAC verification failure logged successfully.");
      }
    });

    return res
      .status(401)
      .send("Forbidden: Invalid HMAC signature, Webhook Rejected!");
  }

  const orderData = req.body;

  // Ghi log ra console
  console.log("Order data received", orderData);

  // Chuẩn bị nội dung ghi vào file (chuyển đối tượng orderData thành chuỗi JSON)
  const logEntry = `Order received at ${new Date().toISOString()}:\n${JSON.stringify(orderData, null, 2)}\n\n`;

  // Ghi nội dung vào file log (file webhook-log.txt)
  fs.appendFile("webhook-log.txt", logEntry, (err) => {
    if (err) {
      console.error("Failed to write to log file", err);
    } else {
      console.log("Order data logged successfully.");
    }
  });
}

// Gọi Shopify API để lấy metafield của khách hàng
async function getCustomerMetafieldId(customerId) {
  try {
    const response = await axios.get(
      `https://${SHOP_NAME}.myshopify.com/admin/api/2023-10/customers/${customerId}/metafields.json`,
      { headers: { "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN } },
    );

    const metafield = response.data.metafields.find(
      (field) => field.namespace === "custom" && field.key === "reward_points",
    );

    return metafield ? metafield.id : null;
  } catch (error) {
    console.error(`Failed to get metafield: ${error.message}`);
    throw error;
  }
}

async function getCustomerRewardPoints(customerId) {
  try {
    const response = await axios.get(
      `https://${SHOP_NAME}.myshopify.com/admin/api/2023-10/customers/${customerId}/metafields.json`,
      { headers: { "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN } },
    );

    const metafield = response.data.metafields.find(
      (field) => field.namespace === "custom" && field.key === "reward_points",
    );

    return metafield ? parseInt(metafield.value, 10) : 0;
  } catch (error) {
    console.error(`Failed to get reward points: ${error.message}`);
    throw error;
  }
}

// Gọi Shopify API để cập nhật điểm thưởng cho khách hàng
async function updateCustomerRewardPoints(metafieldId, newPoints) {
  try {
    const response = await axios({
      method: "PUT",
      url: `https://${SHOP_NAME}.myshopify.com/admin/api/2023-10/metafields/${metafieldId}.json`,
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
      data: {
        metafield: {
          value: newPoints.toString(), // Chuyển thành chuỗi
          type: "number_integer",
        },
      },
    });

    console.log(`Updated reward points: ${response.data.metafield.value}`);
  } catch (error) {
    console.error(`Failed to update reward points: ${error.message}`);
    throw error;
  }
}

app.get("/", (req, res) => res.send("Hello World!"));

// Webhook - Đơn hàng được tạo
app.post("/webhook/orders/create", (req, res) =>
  handleWebhook(req, res, "Order Created"),
);

// Webhook - Đơn hàng bị xóa
app.post("/webhook/orders/delete", (req, res) =>
  handleWebhook(req, res, "Order Deleted"),
);

// Webhook - Sản phẩm được cập nhật
app.post("/webhook/products/update", (req, res) =>
  handleWebhook(req, res, "Product Updated"),
);

// Webhook - Đơn hàng đã thanh toán
const processedOrders = new Set(); // Bộ lưu trữ ID các đơn hàng đã xử lý

app.post("/webhook/orders/paid", (req, res) => {
  const { id: orderId, customer, total_price } = req.body;

  if (processedOrders.has(orderId)) {
    console.log(`Duplicate webhook detected for order ${orderId}. Skipping...`);
    return res.status(200).send("Duplicate webhook. Skipping.");
  }

  processedOrders.add(orderId);

  if (customer) {
    const customerId = customer.id;
    const newPoints = Math.floor(total_price / 10); // 10 USD = 1 điểm

    // Ghi log tính toán điểm thưởng
    logToFile(
      `Order ${orderId} paid for customer ${customerId}. Calculated reward points: ${newPoints}.\n\n`,
    );

    res.status(200).send("Order Paid Webhook Logged.");
  } else {
    logToFile(`No customer information available for order ${orderId}.\n\n`);
    res.status(400).send("No customer information available.");
  }
});

// Webhook - Đơn hàng đã hoàn tất
app.post("/webhook/orders/fulfilled", async (req, res) => {
  const { id: orderId, customer } = req.body;

  if (!customer) {
    logToFile(`No customer information available for order ${orderId}.\n\n`);
    return res.status(400).send("No customer information available.");
  }

  const customerId = customer.id;

  try {
    const metafieldId = await getCustomerMetafieldId(customerId);

    if (metafieldId) {
      const currentPoints = await getCustomerRewardPoints(customerId);
      const newPoints = Math.floor(req.body.total_price / 10); // 10 USD = 1 điểm
      const totalPoints = currentPoints + newPoints;

      // Ghi log thông tin cộng dồn điểm thưởng
      logToFile(
        `Order ${orderId} fulfilled for customer ${customerId}. Current points: ${currentPoints}, adding: ${newPoints}, total: ${totalPoints}.\n\n`,
      );

      await updateCustomerRewardPoints(metafieldId, totalPoints);
      res.status(200).send("Reward points updated successfully.");
    } else {
      logToFile(`Metafield not found for customer ${customerId}.\n\n`);
      res.status(404).send("Metafield not found.");
    }
  } catch (error) {
    console.error(error);
    logToFile(
      `Failed to update reward points for customer ${customerId}: ${error.message}\n\n`,
    );
    res.status(500).send("Failed to update reward points.");
  }
});

// Hàm xử lý chung cho các webhook
function handleWebhook(req, res, eventType) {
  // if (!verifyHMAC(req)) {
  //   const logEntry = `HMAC verification failed at ${new Date().toISOString()}: Invalid HMAC signature for ${eventType}\n\n`;
  //   logToFile(logEntry);
  //   return res.status(401).send("Forbidden: Invalid HMAC signature");
  // }

  const data = req.body;
  console.log(`${eventType} received:`, data);

  const logEntry = `${eventType} at ${new Date().toISOString()}:\n${JSON.stringify(data, null, 2)}\n\n`;
  logToFile(logEntry);

  res.status(200).send(`${eventType} Webhook Received`);
}

app.listen(PORT, () => console.log(`Server is running at port ${PORT}`));
