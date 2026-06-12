import { supabase } from "./supabase";

// Fetch wrapper that attaches the current Supabase access token as a
// Bearer header so the backend can verify the user via
// supabaseAdmin.auth.getUser(). Mirrors the pattern used by the
// dashboard alert bell.
export async function authedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(path, { ...init, headers });
}
