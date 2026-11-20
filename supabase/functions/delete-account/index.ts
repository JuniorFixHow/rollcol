// Deletes the caller's own account (in-app account deletion, required by Apple).
// Deploy: pnpm exec supabase functions deploy delete-account
//
// The database decides what deletion means: staff and student rows in every
// school cascade; the last admin of a school with other staff is blocked.
import { createClient } from "npm:@supabase/supabase-js@2.119.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "Sign in first." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json({ error: "Server is not configured." }, 500);

  // Act as the caller to identify them and ask the database what deletion would do.
  const asUser = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await asUser.auth.getUser();
  if (userError || !userData.user) return json({ error: "Sign in first." }, 401);

  // One row per affected school; any "last_admin" blocks deletion.
  const { data: effects, error: effectError } = await asUser.rpc("account_deletion_effects");
  if (effectError || !Array.isArray(effects)) return json({ error: "Could not check the account." }, 500);
  const blocked: string[] = [];
  for (const row of effects) {
    if (typeof row === "object" && row !== null && row.effect === "last_admin" && typeof row.school_name === "string") {
      blocked.push(row.school_name);
    }
  }
  if (blocked.length > 0) {
    return json({ error: `You are the only admin at ${blocked.join(", ")}. Make another staff member an admin first.` }, 409);
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: deleteError } = await admin.auth.admin.deleteUser(userData.user.id);
  if (deleteError) return json({ error: "Could not delete the account." }, 500);

  return json({ deleted: true });
});
