// Creates a Stripe Checkout Session (subscription mode) for NutriCook Pro.
// Requires STRIPE_SECRET_KEY + STRIPE_PRICE_ID env vars (test or live mode).
// Without them it returns { simulated: true } so the app can demo the flow.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "Method not allowed" } });
    return;
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
  const body = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    success_url: `${origin}/?upgraded=1`,
    cancel_url: `${origin}/?canceled=1`,
  });
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
