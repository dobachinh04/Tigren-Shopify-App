import { registerWebhook } from "./registerWebhook";

export async function setupWebhooks() {
    await registerWebhook("orders/paid", `${process.env.SERVER_URL}/webhooks/orders/paid`);
    await registerWebhook("orders/fulfilled", `${process.env.SERVER_URL}/webhooks/orders/fulfilled`);
}
