const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Cấu hình middleware proxy
app.use('/shopify', createProxyMiddleware({
  target: 'https://quickstart-9fa495fe.myshopify.com',
  changeOrigin: true,
  pathRewrite: {
    '^/shopify': '', // Xóa `/shopify` khỏi request path
  },
  onProxyReq: (proxyReq, req, res) => {
    // Thêm headers cần thiết cho yêu cầu
    proxyReq.setHeader('X-Shopify-Access-Token', '459a1eb3fff01f2eaa7fd1e5d446c1cd');
  }
}));

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Proxy server is running on http://localhost:${PORT}`);
});
