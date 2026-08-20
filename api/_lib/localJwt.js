// Local verification of a Supabase-issued access token (HS256), as an
// opt-in alternative to the network round-trip in getUser()'s default path.
//
// TRADE-OFF, READ BEFORE ENABLING:
// Network getUser() calls Supabase's /auth/v1/user on every request, which
// means a revoked/logged-out session is rejected immediately. Local
// verification only checks the token's signature and expiry — a token
// revoked server-side (e.g. via "sign out everywhere", a banned user, a
// deliberately invalidated session) remains "valid" here until it naturally
// expires (Supabase's default access-token lifetime is 1 hour). This trades
// a small revocation-latency window for skipping a network hop on every
// request to /api/generate.
//
// Disabled by default. Only takes effect if SUPABASE_JWT_SECRET is set
// (Supabase Dashboard → Project Settings → API → JWT Secret). Unset it to
// instantly revert to the network-verified path with no other changes.
import { createHmac, timingSafeEqual } from "node:crypto";

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || "";

export const localVerificationEnabled = Boolean(JWT_SECRET);

function base64UrlDecode(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/").padEnd(str.length + ((4 - (str.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64");
}

// Returns { id, email } if the token's signature and expiry check out,
// otherwise null. Never throws — malformed input is just "not valid".
export function verifyLocalToken(token) {
  if (!JWT_SECRET || !token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;

  try {
    const header = JSON.parse(base64UrlDecode(headerB64).toString("utf8"));
    if (header.alg !== "HS256") return null; // only the algorithm Supabase actually issues

    const expectedSig = createHmac("sha256", JWT_SECRET).update(`${headerB64}.${payloadB64}`).digest();
    const gotSig = base64UrlDecode(sigB64);
    if (expectedSig.length !== gotSig.length || !timingSafeEqual(expectedSig, gotSig)) return null;

    const payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp <= now) return null; // expired
    if (typeof payload.iat === "number" && payload.iat > now + 60) return null; // clock-skew sanity check

    const id = payload.sub;
    const email = payload.email;
    if (!id) return null;
    return { id, email: email || null };
  } catch {
    return null;
  }
}
