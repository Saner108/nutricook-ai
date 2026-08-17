// Who is allowed to call /api/admin/*, read from the ADMIN_EMAILS env var
// (comma-separated). Files under api/ with a leading underscore are not routed
// by Vercel, so this is a helper module and never an endpoint.
//
// No address is hardcoded here on purpose: who is an admin is deployment
// config, not source. Adding or removing an admin is an env-var change (Vercel
// → Project Settings → Environment Variables), and the repo never names the
// accounts worth attacking.
//
// FAIL CLOSED, INTENTIONALLY: if ADMIN_EMAILS is unset, empty, or all-blank the
// allowlist is empty and every caller is denied. A misconfigured admin surface
// that defaults to "allow everyone" — or to some built-in fallback address — is
// far worse than one that is simply unavailable until it is configured.
export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

// Case-insensitive allowlist check. Callers must pass the email from a verified
// token — see _requireAdmin.js — never one supplied by the client.
export function isAllowlisted(email) {
  if (typeof email !== "string") return false;
  const e = email.trim().toLowerCase();
  return e.length > 0 && ADMIN_EMAILS.includes(e);
}
