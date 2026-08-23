// Security unit tests: webhook replay protection, JWT local verification,
// admin allowlist, and server-side model + token pinning.
// Run: node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// ── Helpers ──────────────────────────────────────────────────────────────────

// Build a Stripe-Signature header for a given secret, payload, and timestamp.
function makeStripeHeader(secret, payload, ts) {
  const sig = createHmac("sha256", secret).update(`${ts}.${payload}`).digest("hex");
  return `t=${ts},v1=${sig}`;
}

// Extract signatureValid from stripe-webhook.js and evaluate it in a
// controlled scope that provides the `crypto` binding it uses.
import * as nodeCrypto from "node:crypto";
function loadSignatureValid() {
  const src = readFileSync(
    fileURLToPath(new URL("../api/stripe-webhook.js", import.meta.url)), "utf8"
  );
  const match = src.match(/function signatureValid\([^)]*\) \{[\s\S]*?\n\}/);
  assert.ok(match, "signatureValid not found in stripe-webhook.js");
  // new Function runs in a plain (non-module) context; pass node:crypto as
  // the `crypto` parameter so the function body can call crypto.createHmac etc.
  return new Function("crypto", `${match[0]}; return signatureValid;`)(nodeCrypto);
}
const sv = loadSignatureValid();

// ── signatureValid ────────────────────────────────────────────────────────────

const SECRET  = "whsec_test_secret_value";
const PAYLOAD = '{"type":"checkout.session.completed"}';
const NOW = Math.floor(Date.now() / 1000);

test("signatureValid: correct signature and fresh timestamp → valid", () => {
  const header = makeStripeHeader(SECRET, PAYLOAD, NOW);
  assert.equal(sv(SECRET, header, PAYLOAD), true);
});

test("signatureValid: correct signature but timestamp 301s old → invalid (replay)", () => {
  const header = makeStripeHeader(SECRET, PAYLOAD, NOW - 301);
  assert.equal(sv(SECRET, header, PAYLOAD), false);
});

test("signatureValid: correct signature but timestamp 61s in future → invalid", () => {
  const header = makeStripeHeader(SECRET, PAYLOAD, NOW + 61);
  assert.equal(sv(SECRET, header, PAYLOAD), false);
});

test("signatureValid: wrong secret → invalid", () => {
  const header = makeStripeHeader("wrong_secret", PAYLOAD, NOW);
  assert.equal(sv(SECRET, header, PAYLOAD), false);
});

test("signatureValid: tampered payload → invalid", () => {
  const header = makeStripeHeader(SECRET, PAYLOAD, NOW);
  assert.equal(sv(SECRET, header, PAYLOAD + "x"), false);
});

test("signatureValid: missing t field → invalid", () => {
  const sig = createHmac("sha256", SECRET).update(`${NOW}.${PAYLOAD}`).digest("hex");
  assert.equal(sv(SECRET, `v1=${sig}`, PAYLOAD), false);
});

test("signatureValid: missing v1 field → invalid", () => {
  assert.equal(sv(SECRET, `t=${NOW}`, PAYLOAD), false);
});

test("signatureValid: non-numeric timestamp → invalid", () => {
  const sig = createHmac("sha256", SECRET).update(`abc.${PAYLOAD}`).digest("hex");
  assert.equal(sv(SECRET, `t=abc,v1=${sig}`, PAYLOAD), false);
});

// ── isAllowlisted (source-level: avoids importing supabase deps in test) ─────

test("isAllowlisted: non-string input returns false (source check)", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../api/admin/_allowlist.js", import.meta.url)), "utf8"
  );
  // The function must guard against non-string input
  assert.match(src, /typeof email !== "string"/, "isAllowlisted must check typeof email");
  // Must not allow empty strings through
  assert.match(src, /e\.length > 0/, "isAllowlisted must reject empty strings");
});

test("isAllowlisted: ADMIN_EMAILS defaults to empty (fail-closed) when env unset", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../api/admin/_allowlist.js", import.meta.url)), "utf8"
  );
  // The default fallback must be an empty string (not a built-in admin address)
  assert.match(src, /process\.env\.ADMIN_EMAILS.*\|\|.*""/, "ADMIN_EMAILS must default to empty string");
});

// ── ALLOWED_MODELS in generate.js ────────────────────────────────────────────

const generateSrc = readFileSync(
  fileURLToPath(new URL("../api/generate.js", import.meta.url)), "utf8"
);

test("ALLOWED_MODELS: allowlist exists in generate.js", () => {
  assert.match(generateSrc, /ALLOWED_MODELS/, "ALLOWED_MODELS set must exist in generate.js");
});

test("ALLOWED_MODELS: claude-opus is not in the allowlist", () => {
  // Isolate just the ALLOWED_MODELS block (between 'new Set' and the matching paren)
  const setMatch = generateSrc.match(/new Set\(\[([\s\S]*?)\]\)/);
  assert.ok(setMatch, "ALLOWED_MODELS Set literal must be present");
  assert.doesNotMatch(setMatch[1], /claude-opus/, "claude-opus must not be in ALLOWED_MODELS — cost risk");
});

test("ALLOWED_MODELS: unknown model string falls back to sonnet", () => {
  assert.match(
    generateSrc,
    /ALLOWED_MODELS\.has\(clientModel\).*claude-sonnet/s,
    "unknown models must fall back to claude-sonnet"
  );
});

// ── max_tokens cap in generate.js ────────────────────────────────────────────

test("max_tokens: server-side cap is enforced via Math.min", () => {
  assert.match(generateSrc, /MAX_TOKENS_CAP/, "MAX_TOKENS_CAP constant must exist");
  assert.match(generateSrc, /Math\.min/, "max_tokens must be capped with Math.min");
});

// ── localJwt claim checks ─────────────────────────────────────────────────────

const jwtSrc = readFileSync(
  fileURLToPath(new URL("../api/_lib/localJwt.js", import.meta.url)), "utf8"
);

test("localJwt: exp (expiry) claim is checked", () => {
  assert.match(jwtSrc, /payload\.exp/, "localJwt must check exp claim");
});

test("localJwt: iat (issued-at) clock-skew check is present", () => {
  assert.match(jwtSrc, /payload\.iat/, "localJwt must check iat claim");
});

test("localJwt: nbf (not-before) claim is checked", () => {
  assert.match(jwtSrc, /payload\.nbf/, "localJwt must check nbf claim");
});

// ── userIdFrom (stripe-webhook.js) ───────────────────────────────────────────

function loadUserIdFrom() {
  const src = readFileSync(
    fileURLToPath(new URL("../api/stripe-webhook.js", import.meta.url)), "utf8"
  );
  const match = src.match(/function userIdFrom\([^)]*\) \{[\s\S]*?\n\}/);
  assert.ok(match, "userIdFrom not found in stripe-webhook.js");
  return new Function(`${match[0]}; return userIdFrom;`)();
}
const userIdFrom = loadUserIdFrom();

test("userIdFrom: extracts client_reference_id (checkout.session shape)", () => {
  assert.equal(userIdFrom({ client_reference_id: "user-abc" }), "user-abc");
});

test("userIdFrom: extracts metadata.user_id (subscription shape)", () => {
  assert.equal(userIdFrom({ metadata: { user_id: "user-xyz" } }), "user-xyz");
});

test("userIdFrom: extracts subscription_data.metadata.user_id (checkout params shape)", () => {
  assert.equal(
    userIdFrom({ subscription_data: { metadata: { user_id: "user-deep" } } }),
    "user-deep"
  );
});

test("userIdFrom: returns null when no known field present", () => {
  assert.equal(userIdFrom({}), null);
  assert.equal(userIdFrom(null), null);
  assert.equal(userIdFrom(undefined), null);
});

test("userIdFrom: client_reference_id takes precedence over metadata.user_id", () => {
  // The OR chain resolves left-to-right; first truthy value wins
  assert.equal(
    userIdFrom({ client_reference_id: "first", metadata: { user_id: "second" } }),
    "first"
  );
});

// ── messages validation (generate.js source check) ───────────────────────────

test("generate.js: validates messages is a non-empty array before hitting Anthropic", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../api/generate.js", import.meta.url)), "utf8"
  );
  assert.match(src, /Array\.isArray\(messages\)/, "messages must be validated with Array.isArray");
  assert.match(src, /messages\.length === 0/, "generate.js must reject empty messages array");
});

// ── generate.js health checks (source-level) ─────────────────────────────────

const genSrc = readFileSync(
  fileURLToPath(new URL("../api/generate.js", import.meta.url)), "utf8"
);

test("generate.js: uses AbortController with 25s timeout on upstream fetch", () => {
  assert.match(genSrc, /AbortController/, "must create AbortController");
  assert.match(genSrc, /25[_,]?000|25000/, "must set 25 second timeout");
  assert.match(genSrc, /abort\.signal/, "must pass signal to fetch");
  assert.match(genSrc, /AbortError/, "must handle AbortError with 504 response");
});

test("generate.js: clears timeout on both success and error paths", () => {
  assert.match(genSrc, /clearTimeout\(timeoutId\)/, "must clear timeout after fetch resolves");
});

test("generate.js: rate limit reads from RATE_LIMIT_PER_MINUTE env var", () => {
  assert.match(genSrc, /RATE_LIMIT_PER_MINUTE/, "must read rate limit from env var");
  assert.match(genSrc, /parseInt.*RATE_LIMIT_PER_MINUTE/, "must parse the env var as integer");
});

// ── checkout.js health checks (source-level) ─────────────────────────────────

const checkoutSrc = readFileSync(
  fileURLToPath(new URL("../api/checkout.js", import.meta.url)), "utf8"
);

test("checkout.js: validates STRIPE_PRICE_ID starts with 'price_'", () => {
  assert.match(checkoutSrc, /price_/, "must check price ID format");
  assert.match(checkoutSrc, /startsWith/, "must use startsWith for format check");
});

test("checkout.js: returns 500 with user-friendly message on bad price ID format", () => {
  assert.match(checkoutSrc, /500/, "must return 500 on bad price ID");
  assert.match(checkoutSrc, /not configured correctly/, "must give clear error message");
});

// ── supabaseAdmin.js timeout protection (source-level) ───────────────────────

const adminSrc = readFileSync(
  fileURLToPath(new URL("../api/_lib/supabaseAdmin.js", import.meta.url)), "utf8"
);

test("supabaseAdmin: fetchWithTimeout helper exists with 10s deadline", () => {
  assert.match(adminSrc, /fetchWithTimeout/, "fetchWithTimeout helper must exist");
  assert.match(adminSrc, /10[_,]?000|10000/, "timeout must be 10 seconds");
  assert.match(adminSrc, /AbortController/, "must use AbortController");
  assert.match(adminSrc, /clearTimeout/, "must clear timeout in finally block");
});

test("supabaseAdmin: all Supabase fetches use fetchWithTimeout (not bare fetch)", () => {
  // Count occurrences — bare `await fetch(\`\${URL}` should be zero after replacement
  const bareCount = (adminSrc.match(/await fetch\(`\$\{URL\}/g) || []).length;
  assert.equal(bareCount, 0, `Found ${bareCount} bare fetch() calls — all must use fetchWithTimeout`);
});

test("supabaseAdmin: timeout cleared in finally block (no leak on error)", () => {
  assert.match(adminSrc, /finally\s*\{[\s\S]*?clearTimeout/, "clearTimeout must be in a finally block");
});

// ── INGREDIENT_DB: no duplicates ─────────────────────────────────────────────

const appSrc = readFileSync(
  fileURLToPath(new URL("../artifacts/NutriCookAI_v2.tsx", import.meta.url)), "utf8"
);

test("INGREDIENT_DB: no duplicate entries", () => {
  const match = appSrc.match(/const INGREDIENT_DB = \[[\s\S]*?\];/);
  assert.ok(match, "INGREDIENT_DB must exist");
  const items = (match[0].match(/"([^"]+)"/g) || []).map(s => s.slice(1, -1));
  const seen = {};
  const dups = [];
  items.forEach(i => {
    seen[i] = (seen[i] || 0) + 1;
    if (seen[i] === 2) dups.push(i);
  });
  assert.deepEqual(dups, [], `Duplicate ingredients found: ${dups.join(", ")}`);
});

// ── generate.js message structure validation ──────────────────────────────────

test("generate.js: rejects message array containing null", () => {
  assert.match(
    genSrc,
    /badMessage.*find|find.*badMessage/s,
    "generate.js must check individual message objects, not just the array"
  );
});

test("generate.js: validates each message has role and content", () => {
  assert.match(genSrc, /m\.role/, "each message must be checked for .role");
  assert.match(genSrc, /m\.content === undefined/, "each message must be checked for .content");
});

// ── stripe-webhook: invoice.payment_failed handler ───────────────────────────

const webhookSrc = readFileSync(
  fileURLToPath(new URL("../api/stripe-webhook.js", import.meta.url)), "utf8"
);

test("stripe-webhook: handles invoice.payment_failed event", () => {
  assert.match(
    webhookSrc,
    /invoice\.payment_failed/,
    "stripe-webhook must handle invoice.payment_failed to mark subscriptions past_due"
  );
});

test("stripe-webhook: invoice.payment_failed sets status to past_due", () => {
  const invoiceBlock = webhookSrc.slice(
    webhookSrc.indexOf("invoice.payment_failed"),
    webhookSrc.indexOf("invoice.payment_failed") + 400
  );
  assert.match(invoiceBlock, /past_due/, "payment_failed handler must set status to past_due");
});

// ── generate.js: message count + content size caps ───────────────────────────

test("generate.js: MAX_MESSAGES constant caps message array length", () => {
  assert.match(genSrc, /MAX_MESSAGES/, "MAX_MESSAGES constant must exist");
  assert.match(genSrc, /messages\.length > MAX_MESSAGES/, "must reject too many messages");
});

test("generate.js: MAX_CONTENT_CHARS constant caps total payload size", () => {
  assert.match(genSrc, /MAX_CONTENT_CHARS/, "MAX_CONTENT_CHARS constant must exist");
  assert.match(genSrc, /totalChars > MAX_CONTENT_CHARS/, "must reject oversized content");
});

test("generate.js: content size check handles both string and array content blocks", () => {
  // The check must handle m.content as a string (text messages) and
  // as an array of blocks (vision messages with image + text blocks)
  assert.match(genSrc, /typeof m\.content === "string"/, "must handle string content");
  assert.match(genSrc, /Array\.isArray\(m\.content\)/, "must handle array content blocks");
});
