const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');  // Import module fs để thao tác với file

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post('/webhook/orders/create', (req, res) => {
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

app.listen(PORT, () => {
  console.log(`Server is running at port ${PORT}`);
});
