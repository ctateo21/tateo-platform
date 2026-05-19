import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.warn(
    "[supabase-admin] Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
    "Server-side Supabase admin client is disabled."
  );
}

export const supabaseAdmin = url && serviceKey
  ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;
