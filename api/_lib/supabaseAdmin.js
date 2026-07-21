// Shared serverless helpers for talking to Supabase with the SERVICE ROLE key.
// Files under api/_lib are not routed by Vercel (leading underscore).
// The service-role key bypasses RLS and must never reach the browser.

const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_ANON_KEY;

// Supabase is "on" only when both a URL and the service-role key are present.
// When off, callers fall back to the pre-auth (demo) behavior.
export const supabaseConfigured = Boolean(URL && SERVICE);

// Verify a user access token and return the auth user ({ id, email }) or null.
export async function getUser(accessToken) {
  if (!accessToken || !URL) return null;
  try {
    const r = await fetch(`${URL}/auth/v1/user`, {
      headers: { apikey: ANON || SERVICE, Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? { id: u.id, email: u.email } : null;
  } catch {
    return null;
  }
}

// Pull the bearer token out of an incoming request's Authorization header.
export function bearer(req) {
  const h = req.headers["authorization"] || req.headers["Authorization"] || "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

// Call a Postgres function (RPC) with the service role. Returns parsed JSON or null.
export async function rpc(fn, args) {
  if (!supabaseConfigured) return null;
  try {
    const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args || {}),
    });
    if (!r.ok) return null;
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

// Upsert rows into a table with the service role (merge on the primary key).
export async function upsert(table, rows) {
  if (!supabaseConfigured) return false;
  try {
    const r = await fetch(`${URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(Array.isArray(rows) ? rows : [rows]),
    });
    return r.ok;
  } catch {
    return false;
  }
}

// Read a single row's columns via PostgREST with the service role.
export async function selectOne(table, match, columns = "*") {
  if (!supabaseConfigured) return null;
  const qs = Object.entries(match).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join("&");
  try {
    const r = await fetch(`${URL}/rest/v1/${table}?${qs}&select=${columns}&limit=1`, {
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    });
    if (!r.ok) return null;
    const rows = await r.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch {
    return null;
  }
}
