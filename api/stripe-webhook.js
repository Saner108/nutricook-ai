// Stripe webhook receiver for subscription lifecycle events.
// Verifies the Stripe-Signature header (HMAC SHA-256) with STRIPE_WEBHOOK_SECRET.
// NOTE: with no database yet, events are logged only. Production path:
// persist customer/subscription status in a store (e.g. Vercel KV) keyed by
// customer email, and have the app check it on load.
import crypto from "crypto";

export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", c => { data += c; });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).end(); return; }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const payload = await readRawBody(req);
  if (secret) {
    const sig = req.headers["stripe-signature"] || "";
    const parts = Object.fromEntries(sig.split(",").map(p => p.split("=")));
    const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${payload}`).digest("hex");
    const valid = parts.v1 && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
    if (!valid) { res.status(400).json({ error: { message: "Invalid signature" } }); return; }
  }
  let event = {};
  try { event = JSON.parse(payload); } catch {}
  switch (event.type) {
    case "checkout.session.completed":
      console.log("[stripe] subscription started:", event.data?.object?.customer_email || event.data?.object?.customer);
      break;
    case "customer.subscription.deleted":
      console.log("[stripe] subscription canceled:", event.data?.object?.customer);
      break;
    default:
      break;
  }
  res.status(200).json({ received: true });
}
