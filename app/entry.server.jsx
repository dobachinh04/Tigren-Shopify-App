// tigren-app/app/entry.server.jsx

import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { RemixServer } from "@remix-run/react";
import { createReadableStreamFromReadable } from "@remix-run/node";
import { isbot } from "isbot";
import { addDocumentResponseHeaders } from "./shopify.server";
import { updateCustomerPoints, getOrder } from "./api/shopify/shopify";
import { setupWebhooks } from "./api/shopify/setupWebhooks";

const ABORT_DELAY = 5000;

export default async function handleRequest(
  request,
  responseStatusCode,
  responseHeaders,
  remixContext,
) {
  addDocumentResponseHeaders(request, responseHeaders);
  const userAgent = request.headers.get("user-agent");
  const callbackName = isbot(userAgent ?? "") ? "onAllReady" : "onShellReady";

  // Xử lý webhook cho events
  const url = new URL(request.url);
  if (url.pathname === "/webhooks/orders/paid" && request.method === "POST") {
    const payload = await request.json();
    const { customer_id, total_price } = payload.order;

    // Tính toán điểm thưởng dựa trên giá trị đơn hàng
    const points = Math.floor(total_price / 10);
    await updateCustomerPoints(customer_id, points);

    return new Response("Order paid webhook processed", { status: 200 });
  }

  if (url.pathname === "/webhooks/orders/fulfilled" && request.method === "POST") {
    const payload = await request.json();
    const { id, customer_id } = payload.order;

    // Kiểm tra đơn hàng hoàn tất và cập nhật điểm thưởng
    const order = await getOrder(id);
    if (order.order.fulfillment_status === 'fulfilled') {
      const points = Math.floor(order.order.total_price / 10);
      await updateCustomerPoints(customer_id, points);
    }
    return new Response("Order fulfilled webhook processed", { status: 200 });
  }

  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      <RemixServer
        context={remixContext}
        url={request.url}
        abortDelay={ABORT_DELAY}
      />,
      {
        [callbackName]: () => {
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          console.error(error);
        },
      },
    );

    setTimeout(abort, ABORT_DELAY);
  });
}

setupWebhooks().catch(console.error);
