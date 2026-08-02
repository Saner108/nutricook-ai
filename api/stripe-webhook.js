// Stripe webhook receiver for subscription lifecycle events.
// Verifies the Stripe-Signature header (HMAC SHA-256) with STRIPE_WEBHOOK_SECRET,
// then upserts the `subscriptions` row (via the Supabase service role) so the app
// has a single source of truth for Pro status. When Supabase isn't configured the
// events are simply logged, as before.
import crypto from "crypto";
import { supabaseConfigured, upsert } from "./_lib/supabaseAdmin.js";

export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", c => { data += c; });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function signatureValid(secret, sigHeader, payload) {
  const parts = Object.fromEntries(String(sigHeader).split(",").map(p => p.split("=")));
  if (!parts.t || !parts.v1) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${parts.t}.${payload}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b); // length guard: timingSafeEqual throws on mismatch
}

// Pull the user id off whichever object shape the event carries.
function userIdFrom(obj) {
  return obj?.client_reference_id || obj?.metadata?.user_id || obj?.subscription_data?.metadata?.user_id || null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).end(); return; }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const payload = await readRawBody(req);
  if (secret && !signatureValid(secret, req.headers["stripe-signature"] || "", payload)) {
    res.status(400).json({ error: { message: "Invalid signature" } });
    return;
  }

  let event = {};
  try { event = JSON.parse(payload); } catch {}
  const obj = event.data?.object || {};
  const userId = userIdFrom(obj);

  const persist = async row => {
    if (!supabaseConfigured || !row.user_id) return;
    await upsert("subscriptions", row);
  };

  switch (event.type) {
    case "checkout.session.completed":
      console.log("[stripe] subscription started:", obj.customer_email || obj.customer);
      await persist({
        user_id: userId,
        stripe_customer_id: obj.customer || null,
        stripe_subscription_id: obj.subscription || null,
        status: "active",
      });
      break;
    case "customer.subscription.updated":
      await persist({
        user_id: userId,
        stripe_customer_id: obj.customer || null,
        stripe_subscription_id: obj.id || null,
        status: obj.status === "active" || obj.status === "trialing" ? "active"
          : obj.status === "past_due" ? "past_due" : obj.status || "none",
        current_period_end: obj.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : null,
      });
      break;
    case "customer.subscription.deleted":
      console.log("[stripe] subscription canceled:", obj.customer);
      await persist({
        user_id: userId,
        stripe_customer_id: obj.customer || null,
        stripe_subscription_id: obj.id || null,
        status: "canceled",
        current_period_end: obj.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : null,
      });
      break;
    default:
      break;
  }
  res.status(200).json({ received: true });
}
