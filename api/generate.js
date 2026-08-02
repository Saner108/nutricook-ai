// Vercel serverless proxy for the Anthropic Messages API.
// The API key lives only in the ANTHROPIC_API_KEY env var — it is never sent
// to (or readable from) the browser.
//
// When Supabase is configured, this endpoint also enforces auth + the free-tier
// quota: a valid user token is required (401 otherwise), and once the daily free
// allowance is spent it returns 402 { error: { code: "quota_exceeded" } } so the
// frontend can open the paywall. Pro subscribers are never gated. With Supabase
// absent it behaves exactly as before (open proxy) so demo mode still works.
import { supabaseConfigured, getUser, bearer, rpc } from "./_lib/supabaseAdmin.js";

function isScanRequest(messages) {
  return (Array.isArray(messages) ? messages : []).some(
    m => Array.isArray(m?.content) && m.content.some(c => c && c.type === "image")
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "Method not allowed" } });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: { message: "ANTHROPIC_API_KEY not configured" } });
    return;
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  } catch {
    res.status(400).json({ error: { message: "Invalid JSON body" } });
    return;
  }
  const { model, max_tokens, messages, stream } = body;

  // Auth + quota gate (only when Supabase is configured).
  if (supabaseConfigured) {
    const user = await getUser(bearer(req));
    if (!user) {
      res.status(401).json({ error: { message: "Sign in required" } });
      return;
    }
    const kind = isScanRequest(messages) ? "scan" : "gen";
    const allowed = await rpc("consume_quota", { p_user: user.id, p_kind: kind });
    if (allowed === false) {
      res.status(402).json({ error: { code: "quota_exceeded", message: "Daily free limit reached" } });
      return;
    }
    // allowed === null means the quota check itself failed (e.g. transient DB
    // error); fail open on metering rather than blocking a valid/paying user.
  }

  let upstream;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model, max_tokens, messages, ...(stream === true ? { stream: true } : {}) }),
    });
  } catch {
    res.status(502).json({ error: { message: "Upstream request to Anthropic failed" } });
    return;
  }

  if (stream === true && upstream.ok && upstream.body) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    const reader = upstream.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    } finally {
      res.end();
    }
    return;
  }

  const text = await upstream.text();
  res.statusCode = upstream.status;
  res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
  res.end(text);
}
