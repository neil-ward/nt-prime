// ---------------------------------------------------------------------------
// Supabase server-side clients — NEVER import this in "use client" components.
//
// Two clients:
//   supabaseAdmin()  — uses service-role key, bypasses RLS. For event inserts.
//   supabasePublic() — uses anon key, respects RLS. For analytics reads.
//
// Both are lazily created and cached in module scope (same pattern as data.ts).
// ---------------------------------------------------------------------------

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;
let _public: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (!_admin) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    _admin = createClient(url, key);
  }
  return _admin;
}

export function supabasePublic(): SupabaseClient {
  if (!_public) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
    _public = createClient(url, key);
  }
  return _public;
}
