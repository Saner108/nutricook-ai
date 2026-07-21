// Frontend Supabase client. Reads Vite-exposed env vars (VITE_ prefix is required
// for anything shipped to the browser). When they're absent the app runs in DEMO
// MODE — no client, session-only mock state, exactly like v2.5.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabase = Boolean(url && anon);

// Only the anon (public) key ever reaches the browser. Row-Level Security is what
// keeps each user to their own rows; the service-role key stays in serverless.
export const supabase = hasSupabase ? createClient(url, anon) : null;
