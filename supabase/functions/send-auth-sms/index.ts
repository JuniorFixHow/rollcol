// Supabase Auth "Send SMS" hook: sends the parent app's sign-in code through
// RollCol's SMS provider (Sailup or Arkesel), so codes reach Ghanaian numbers
// with the RollCol sender name.
//
// Codes go only to numbers a school added as a guardian (at a school that uses
// the parent app), so nobody can make RollCol text random numbers.
//
// Deploy with --no-verify-jwt: Supabase Auth signs each call instead.
// Secrets:
//   SEND_SMS_HOOK_SECRET  from Authentication > Hooks (starts with v1,whsec_)
//   SMS_PROVIDER, SMS_SENDER_ID, SAILUP_API_KEY or ARKESEL_API_KEY  as for send-sms
// Provided by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { createClient } from "npm:@supabase/supabase-js@2.119.2";

interface HookPayload {
  user: { id: string; phone: string };
  sms: { otp: string };
}

function isHookPayload(value: unknown): value is HookPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  const user = record.user as Record<string, unknown> | undefined;
  const sms = record.sms as Record<string, unknown> | undefined;
  return typeof user?.phone === "string" && typeof sms?.otp === "string" && /^[0-9]{4,10}$/.test(sms.otp);
}

/**
 * The hook's way of reporting a failure. Supabase Auth only reads the error
 * object from a 200 response (any other status becomes a generic "could not
 * send" error), then answers the app with http_code and this message.
 */
function fail(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function send(to: string, body: string): Promise<string | null> {
  const provider = (Deno.env.get("SMS_PROVIDER") ?? "test").toLowerCase();
  const sender = Deno.env.get("SMS_SENDER_ID") ?? "";
  if (provider === "test") return "Sign-in codes are not sent while RollCol SMS is in test mode.";
  if (!sender || sender.length > 11) return "SMS_SENDER_ID must be set (at most 11 characters).";

  if (provider === "sailup") {
    const key = Deno.env.get("SAILUP_API_KEY");
    if (!key) return "SAILUP_API_KEY must be set.";
    const response = await fetch("https://api.sailup.io/v1/sms/", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: sender, to: [to], body }),
      signal: AbortSignal.timeout(15000),
    });
    const text = await response.text();
    if (!response.ok) return `Sailup ${response.status}: ${text.slice(0, 200)}`;
    if (text.includes('"pending_balance"')) return "The Sailup account has no credit.";
    if (text.includes('"failed"')) return "Sailup did not send the message.";
    return null;
  }
  if (provider === "arkesel") {
    const key = Deno.env.get("ARKESEL_API_KEY");
    if (!key) return "ARKESEL_API_KEY must be set.";
    const response = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
      method: "POST",
      headers: { "api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ sender, message: body, recipients: [to.replace(/^\+/, "")] }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return `Arkesel ${response.status}: ${(await response.text()).slice(0, 200)}`;
    return null;
  }
  return `Unknown SMS_PROVIDER "${provider}".`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail(405, "Use POST.");
  const secret = Deno.env.get("SEND_SMS_HOOK_SECRET");
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || !url || !serviceKey) {
    console.error("send-auth-sms: missing secrets");
    return fail(500, "Sign-in codes are not set up yet.");
  }

  const raw = await req.text();
  let payload: unknown;
  try {
    payload = new Webhook(secret.replace("v1,whsec_", "")).verify(raw, Object.fromEntries(req.headers));
  } catch {
    return fail(401, "This request was not signed by Supabase Auth.");
  }
  if (!isHookPayload(payload)) return fail(400, "The request is not a sign-in code.");

  const phone = payload.user.phone.startsWith("+") ? payload.user.phone : `+${payload.user.phone}`;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: allowed, error } = await admin.rpc("auth_sms_allowed", { p_phone: phone });
  if (error) {
    console.error("send-auth-sms: auth_sms_allowed failed", error.message);
    return fail(500, "RollCol could not check this number. Please try again.");
  }
  if (allowed !== true) {
    return fail(403, "This number is not on a school's guardian list in RollCol. Use the number your child's school has.");
  }

  const problem = await send(
    phone,
    `${payload.sms.otp} is your RollCol sign-in code. Do not share it with anyone, including school staff.`,
  ).catch((caught) => (caught instanceof Error ? caught.message : "Could not reach the SMS provider."));
  if (problem) {
    console.error("send-auth-sms: not sent", problem);
    return fail(502, problem.includes("test mode") ? problem : "RollCol could not send the code. Please try again in a moment.");
  }
  return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
});
