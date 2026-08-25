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

// Look up an auth user by email with the service role (GoTrue Admin API).
//
// Return contract — the two failure modes are NOT the same thing and callers
// must not conflate them:
//   - null:      every page was scanned successfully and no match was found.
//                A genuine "no such user".
//   - undefined: the lookup itself could not be completed (a fetch threw, a
//                page came back !r.ok, or the response body wasn't in either
//                shape GoTrue is known to return). This says nothing about
//                whether the user exists — the question was never answered.
//   - {id,email}: a verified match.
//
// The `?filter=` / `?email=` query params are deliberately NOT relied on: what
// they do varies by GoTrue version — some treat it as an exact match, some as a
// partial/substring match, and some ignore it entirely and return the full
// list. A row coming back from the server therefore proves nothing, so the
// first result is never trusted: every candidate is re-verified against the
// requested address exactly (case-insensitively) before it is returned, and we
// page through the list client-side so the lookup behaves the same on every
// version. Paging the whole user list is fine at this project's size.
export async function getUserByEmail(email) {
  if (!supabaseConfigured || !email) return undefined;
  const wanted = String(email).trim().toLowerCase();
  if (!wanted) return undefined;
  const perPage = 200;
  try {
    // Hard page cap so a misbehaving/ignored pagination param can't loop forever.
    for (let page = 1; page <= 50; page++) {
      const r = await fetch(`${URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
        headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
      });
      if (!r.ok) return undefined;
      const body = await r.json();
      let users;
      if (Array.isArray(body)) users = body;
      else if (Array.isArray(body?.users)) users = body.users;
      else return undefined;   // unexpected response shape — lookup not completed
      if (!users.length) return null;   // empty page, successfully scanned: no match
      const hit = users.find(u => typeof u?.email === "string" && u.email.trim().toLowerCase() === wanted);
      if (hit && hit.id) return { id: hit.id, email: hit.email };
      if (users.length < perPage) return null;   // last page, no match
    }
    return null;   // hard page cap reached with no match found on any scanned page
  } catch {
    return undefined;
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

// Internal: shared fetch/headers/error-handling for both write helpers below.
// The only thing that differs between upsert() and insertRow() is whether
// Postgres is told to merge-duplicate on conflict — everything else (method,
// auth headers, array-wrapping the body, swallowing fetch errors into `false`)
// is identical, so it lives here once. Not exported: callers use upsert() /
// insertRow() so the "why" for each stays attached to a named function instead
// of a boolean flag at the call site.
async function writeRows(table, rows, { merge } = {}) {
  if (!supabaseConfigured) return false;
  try {
    const r = await fetch(`${URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
        "Content-Type": "application/json",
        Prefer: merge ? "resolution=merge-duplicates,return=minimal" : "return=minimal",
      },
      body: JSON.stringify(Array.isArray(rows) ? rows : [rows]),
    });
    return r.ok;
  } catch {
    return false;
  }
}

// Upsert rows into a table with the service role (merge on the primary key).
export async function upsert(table, rows) {
  return writeRows(table, rows, { merge: true });
}

// Plain insert of one row with the service role. Returns true on success.
//
// Deliberately NOT upsert(): upsert() sends `Prefer: resolution=merge-duplicates`,
// which on an append-only table (admin_logs) would quietly overwrite an existing
// record instead of appending a new one — i.e. it could rewrite audit history.
// This sends `return=minimal` only, so a duplicate is a failed insert (false)
// rather than a silent replacement.
export async function insertRow(table, row) {
  return writeRows(table, row, { merge: false });
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
