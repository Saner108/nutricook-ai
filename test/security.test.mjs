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
