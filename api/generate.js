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
  const { max_tokens: clientTokens, messages, stream } = body;

  // Validate messages before touching the API — undefined/null/empty would be
  // silently dropped from JSON.stringify, sending Anthropic a body with no
  // `messages` field and returning a cryptic 400 to the client.
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: { message: "messages must be a non-empty array" } });
    return;
  }

  // Cap max_tokens server-side — the client value is advisory, not trusted.
  // Recipe generation needs ~1500, remix ~1200, scan ~300. A crafted request
  // could otherwise claim max_tokens: 100000 and burn the entire API budget.
  // 2000 is generous for all legitimate use cases and blocks runaway requests.
  const MAX_TOKENS_CAP = 2000;
  const max_tokens = Math.min(
    typeof clientTokens === "number" && clientTokens > 0 ? clientTokens : MAX_TOKENS_CAP,
    MAX_TOKENS_CAP
  );

  // Pin allowed models server-side — never trust the client-supplied model
  // string. A crafted request could otherwise use claude-opus-4-6 at 15×
  // the cost. Scan requests need vision; recipe generation uses sonnet.
  const ALLOWED_MODELS = new Set([
    "claude-haiku-4-5-20251001",
    "claude-sonnet-4-6",
  ]);
  const clientModel = body.model || "";
  const model = ALLOWED_MODELS.has(clientModel) ? clientModel : "claude-sonnet-4-6";

  // Auth + rate limit + quota gate (only when Supabase is configured).
  if (supabaseConfigured) {
    const user = await getUser(bearer(req));
    if (!user) {
      res.status(401).json({ error: { message: "Sign in required" } });
      return;
    }
    // Short-window abuse guard (requests/minute), checked before the daily
    // quota so a rapid-fire loop gets stopped cheaply rather than burning
    // through consume_quota's transaction on every hit.
    const withinRateLimit = await rpc("check_rate_limit", { p_user: user.id, p_limit: 20 });
    if (withinRateLimit === false) {
      res.status(429).json({ error: { code: "rate_limited", message: "Too many requests — please slow down." } });
      return;
    }
    // withinRateLimit === null means the check itself failed (e.g. transient
    // DB error, or migration_ratelimit.sql not yet run); fail open here too,
    // same policy as the quota check below.
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
