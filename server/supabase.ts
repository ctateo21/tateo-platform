import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.warn(
    "[supabase-admin] Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
    "Server-side Supabase admin client is disabled."
  );
}

// supabase-js initializes a RealtimeClient even if we never subscribe.
// On Node < 22 there's no global WebSocket, so we pass `ws` as the transport
// to prevent a startup crash. We never actually use realtime server-side.
export const supabaseAdmin = url && serviceKey
  ? createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: ws as any },
    })
  : null;
