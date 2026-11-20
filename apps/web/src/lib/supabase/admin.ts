import type { Database } from "@rollcol/shared";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

/**
 * Service-role client. It bypasses RLS, so use it only for Auth admin calls
 * (inviting staff, deleting accounts), never for reading or writing school data.
 */
export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) {
    throw new Error("Missing SUPABASE_SECRET_KEY. Add it to apps/web/.env.local.");
  }
  return createClient<Database>(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Base URL for links in emails (invites, password resets). */
export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return url.replace(/\/$/, "");
}
