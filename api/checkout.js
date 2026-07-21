// Creates a Stripe Checkout Session (subscription mode) for NutriCook Pro.
// Requires STRIPE_SECRET_KEY + STRIPE_PRICE_ID env vars (test or live mode).
// Without them it returns { simulated: true } so the app can demo the flow.
//
// When Supabase is configured we require a signed-in user and stamp the session
// with client_reference_id + metadata.user_id so the webhook can attribute the
// resulting subscription back to that user. The user's email is passed to Stripe
// so the Customer is reused across upgrades.
import { supabaseConfigured, getUser, bearer } from "./_lib/supabaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "Method not allowed" } });
    return;
  }

  let userId = null, email = null;
  if (supabaseConfigured) {
    const user = await getUser(bearer(req));
    if (!user) {
      res.status(401).json({ error: { message: "Sign in required" } });
      return;
    }
    userId = user.id;
    email = user.email;
  }

  const key = process.env.STRIPE_SECRET_KEY;
  const price = process.env.STRIPE_PRICE_ID;
  if (!key || !price) {
    res.status(200).json({ simulated: true });
    return;
  }
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const origin = `${proto}://${host}`;
  const params = {
    mode: "subscription",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    success_url: `${origin}/?upgraded=1`,
    cancel_url: `${origin}/?canceled=1`,
  };
  if (userId) {
    params.client_reference_id = userId;
    params["metadata[user_id]"] = userId;
    params["subscription_data[metadata][user_id]"] = userId;
  }
  if (email) params.customer_email = email;
  const body = new URLSearchParams(params);
  try {
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = await r.json();
    if (!r.ok) {
      res.status(r.status).json({ error: { message: data.error?.message || "Stripe error" } });
      return;
    }
    res.status(200).json({ url: data.url });
  } catch {
    res.status(502).json({ error: { message: "Could not reach Stripe" } });
  }
}
