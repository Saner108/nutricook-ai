// Frontend Supabase client. Reads Vite-exposed env vars (VITE_ prefix is required
// for anything shipped to the browser). When they're absent the app runs in DEMO
// MODE — no client, session-only mock state, exactly like v2.5.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabase = Boolean(url && anon);

// Only the anon (public) key ever reaches the browser. Row-Level Security is what
// keeps each user to their own rows; the service-role key stays in serverless.
// persistSession: false keeps the access/refresh tokens in memory only (not
// localStorage) — trade-off is the user is signed out on a hard page refresh,
// which was an accepted trade-off to reduce token-theft surface (e.g. from a
// compromised dependency) since nothing here needs "stay signed in forever".
export const supabase = hasSupabase
  ? createClient(url, anon, { auth: { persistSession: false } })
  : null;
