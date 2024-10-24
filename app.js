const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');  // Import module fs để thao tác với file
const crypto = require('crypto'); // Import module crypto để tính toán HMAC

const app = express();
const PORT = 3000;

const SHOPIFY_SECRET = '459a1eb3fff01f2eaa7fd1e5d446c1cd';

app.use(bodyParser.json());

// Hàm để xác minh chữ ký HMAC
function verifyHMAC(req) {
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256'); // Lấy chữ ký HMAC từ header
  const payload = JSON.stringify(req.body); // Chuyển đổi payload thành chuỗi JSON

  // Tính toán HMAC từ payload
  const calculatedHMAC = crypto
    .createHmac('sha256', SHOPIFY_SECRET)
    .update(payload, 'utf8')
    .digest('base64'); // Chuyển đổi HMAC thành base64

  // So sánh chữ ký HMAC
  return crypto.timingSafeEqual(Buffer.from(hmacHeader, 'base64'), Buffer.from(calculatedHMAC, 'base64'));
}

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// Webhook cho sự kiện tạo đơn hàng
app.post('/webhook/orders/create', (req, res) => {
  if (!verifyHMAC(req)) {
    // Ghi log trạng thái thất bại khi xác minh HMAC
    const logEntry = `HMAC verification failed at ${new Date().toISOString()}: Invalid HMAC signature!\n\n`;
    fs.appendFile('webhook-log.txt', logEntry, (err) => {
      if (err) {
        console.error('Failed to write to log file', err);
      } else {
        console.log('HMAC verification failure logged successfully.');
      }
    });

    return res.status(401).send('Forbidden: Invalid HMAC signature, Webhook Rejected!');
  }

  const orderData = req.body;

  // Ghi log ra console
  console.log('Order data received', orderData);

  // Chuẩn bị nội dung ghi vào file (chuyển đối tượng orderData thành chuỗi JSON)
  const logEntry = `Order received at ${new Date().toISOString()}:\n${JSON.stringify(orderData, null, 2)}\n\n`;

  // Ghi nội dung vào file log (file webhook-log.txt)
  fs.appendFile('webhook-log.txt', logEntry, (err) => {
    if (err) {
      console.error('Failed to write to log file', err);
    } else {
      console.log('Order data logged successfully.');
    }
  });

  res.status(200).send('Webhook Received');
});

// Webhook cho sự kiện xóa đơn hàng
app.post('/webhook/orders/delete', (req, res) => {
  const deletedOrderData = req.body;

  // Ghi log ra console
  console.log('Deleted order data received', deletedOrderData);

  // Chuẩn bị nội dung ghi vào file (chuyển đối tượng deletedOrderData thành chuỗi JSON)
  const logEntry = `Order deleted at ${new Date().toISOString()}:\n${JSON.stringify(deletedOrderData, null, 2)}\n\n`;

  // Ghi nội dung vào file log (file webhook-log.txt)
  fs.appendFile('webhook-log.txt', logEntry, (err) => {
    if (err) {
      console.error('Failed to write to log file', err);
    } else {
      console.log('Deleted order data logged successfully.');
    }
  });

  res.status(200).send('Webhook for Order Deletion Received');
});

// Webhook cho sự kiện cập nhật sản phẩm
app.post('/webhook/products/update', (req, res) => {
  const updatedProductData = req.body;

  // Ghi log ra console
  console.log('Product update received', updatedProductData);

  // Lấy thông tin cần thiết: title, price, và inventory
  const { title, price, inventory } = updatedProductData;

  // Chuẩn bị nội dung ghi vào file log (chuyển đổi thông tin thành chuỗi JSON)
  const logEntry = `Product updated at ${new Date().toISOString()}:\nTitle: ${title}\nPrice: ${price}\nInventory: ${inventory}\n\n`;

  // Ghi nội dung vào file log (file webhook-log.txt)
  fs.appendFile('webhook-log.txt', logEntry, (err) => {
    if (err) {
      console.error('Failed to write to log file', err);
    } else {
      console.log('Product update logged successfully.');
    }
  });

  res.status(200).send('Webhook for Product Update Received');
});

// Khởi động server
app.listen(PORT, () => {
  console.log(`Server is running at port ${PORT}`);
});
