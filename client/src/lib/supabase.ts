import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

function isValidHttpUrl(s: string | undefined): s is string {
  if (!s) return false;
  try { const u = new URL(s); return u.protocol === "http:" || u.protocol === "https:"; }
  catch { return false; }
}

let client: SupabaseClient;
export const supabaseReady = isValidHttpUrl(url) && !!anonKey && anonKey.length > 20;

if (supabaseReady) {
  client = createClient(url!, anonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "tateo_supabase_session",
    },
  });
} else {
  console.error(
    "[supabase] Disabled: VITE_SUPABASE_URL must be an https URL (got %o) and " +
    "VITE_SUPABASE_ANON_KEY must be set (got %d chars). Auth/persistence are turned off until both are fixed.",
    url, anonKey?.length ?? 0
  );
  // Use a real client pointed at a harmless placeholder so the type stays valid,
  // but every call will fail with a clear error instead of crashing the app at import.
  client = createClient("https://invalid.supabase.co", "placeholder-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export const supabase = client;
