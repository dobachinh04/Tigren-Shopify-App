require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
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

function verifyHMAC(req) {
  const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
  const payload = JSON.stringify(req.body);

  const calculatedHMAC = crypto
    .createHmac("sha256", SHOPIFY_SECRET)
    .update(payload, "utf8")
    .digest("base64");

  return crypto.timingSafeEqual(
    Buffer.from(hmacHeader, "base64"),
    Buffer.from(calculatedHMAC, "base64"),
  );
}

// Hàm ghi log vào file
function logToFile(logEntry) {
  fs.appendFile("webhook-log.txt", logEntry, (err) => {
    if (err) {
      console.error("Failed to write to log file", err);
    } else {
      console.log("Log entry recorded successfully.");
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

    // Ghi log tính toán điểm thưởng, nhưng không cập nhật
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
  const { id: orderId, customer, total_price } = req.body;

  if (!customer) {
    logToFile(`No customer information for order ${orderId}\n\n`);
    return res.status(400).send("No customer information.");
  }

  const customerId = customer.id;

  try {
    const metafieldId = await getCustomerMetafieldId(customerId);
    if (!metafieldId) {
      logToFile(`Metafield not found for customer ${customerId}\n\n`);
      return res.status(404).send("Metafield not found.");
    }

    const currentPoints = await getCustomerRewardPoints(customerId);
    const newPoints = Math.floor(total_price / 10); // 10 USD = 1 điểm
    const totalPoints = currentPoints + newPoints;

    logToFile(
      `Customer ${customerId}: ${currentPoints} + ${newPoints} = ${totalPoints} points\n\n`,
    );

    await updateCustomerRewardPoints(metafieldId, totalPoints);
    res.status(200).send("Reward points updated successfully.");
  } catch (error) {
    console.error(error);
    logToFile(`Failed to update reward points: ${error.message}\n\n`);
    res.status(500).send("Failed to update reward points.");
  }
});

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
