// Sends the SMS that are due in sms_outbox. Called every minute by the
// database (pg_net) when something is waiting; never by browsers.
// Deploy: pnpm exec supabase functions deploy send-sms --no-verify-jwt
//
// Secrets (Supabase dashboard > Edge Functions > Secrets):
//   CRON_SECRET       the same value as cron_secret in private.config
//   SMS_PROVIDER      "test" (default: nothing leaves RollCol), "sailup" or "arkesel"
//   SMS_SENDER_ID     the approved sender name, at most 11 characters (RollCol)
//   SAILUP_API_KEY    project API key from the Sailup dashboard (starts with sailup_)
//   ARKESEL_API_KEY   only if SMS_PROVIDER is arkesel
import { createClient } from "npm:@supabase/supabase-js@2.119.2";

type Due = { id: number; to_phone: string; body: string };
type Result = { ok: true; providerId: string } | { ok: false; error: string };
type Provider = (sms: Due) => Promise<Result>;

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// Compares secrets without leaking how much of them matched.
function sameSecret(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let difference = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    difference |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return difference === 0;
}

function isDue(row: unknown): row is Due {
  if (typeof row !== "object" || row === null) return false;
  const value = row as Record<string, unknown>;
  return typeof value.id === "number" && typeof value.to_phone === "string" && typeof value.body === "string";
}

// Test mode: records the message as sent without sending it. Read the text on
// the Messages page in RollCol.
const testProvider: Provider = async () => ({ ok: true, providerId: "test" });

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

async function readJson(response: Response): Promise<{ text: string; body: Record<string, unknown> }> {
  const text = await response.text();
  try {
    return { text, body: asRecord(JSON.parse(text)) };
  } catch {
    return { text, body: {} };
  }
}

// Sailup SMS API (https://www.sailup.io/docs/sms). One request per message, so
// each message gets its own id for delivery reports.
function sailup(apiKey: string, sender: string): Provider {
  return async (sms) => {
    try {
      const response = await fetch("https://api.sailup.io/v1/sms/", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: sender, to: [sms.to_phone], body: sms.body }),
        signal: AbortSignal.timeout(15000),
      });
      const { text, body } = await readJson(response);
      if (!response.ok) {
        const detail = body.detail ?? body.message ?? body.error;
        const message = typeof detail === "string" ? detail : text.slice(0, 200);
        return { ok: false, error: `Sailup ${response.status}: ${message}` };
      }
      const messages = Array.isArray(body.messages) ? body.messages : [];
      const first = asRecord(messages[0]);
      const id = typeof first.id === "string" ? first.id : null;
      // "pending_balance" means the Sailup account is out of credit; "failed" means Sailup did not send it.
      if (first.status === "pending_balance") return { ok: false, error: "Sailup account has no credit." };
      if (first.status === "failed") return { ok: false, error: "Sailup did not send the message." };
      if (!id) return { ok: false, error: "Sailup did not return a message id." };
      return { ok: true, providerId: id };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Could not reach Sailup." };
    }
  };
}

// Arkesel SMS API, version 2. Numbers go without the leading plus.
function arkesel(apiKey: string, sender: string): Provider {
  return async (sms) => {
    try {
      const response = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ sender, message: sms.body, recipients: [sms.to_phone.replace(/^\+/, "")] }),
        signal: AbortSignal.timeout(15000),
      });
      const { text, body: result } = await readJson(response);
      if (!response.ok || result.status !== "success") {
        const message = typeof result.message === "string" ? result.message : text.slice(0, 200);
        return { ok: false, error: `Arkesel ${response.status}: ${message}` };
      }
      const data = Array.isArray(result.data) ? result.data : [];
      const first = asRecord(data[0]);
      const id = typeof first.id === "string" ? first.id : "arkesel";
      return { ok: true, providerId: id };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Could not reach Arkesel." };
    }
  };
}

function chooseProvider(): Provider | string {
  const name = (Deno.env.get("SMS_PROVIDER") ?? "test").toLowerCase();
  if (name === "test") return testProvider;
  const sender = Deno.env.get("SMS_SENDER_ID");
  if (!sender) return "SMS_SENDER_ID must be set.";
  if (sender.length > 11) return "SMS_SENDER_ID must be at most 11 characters.";
  if (name === "sailup") {
    const key = Deno.env.get("SAILUP_API_KEY");
    if (!key) return "SAILUP_API_KEY must be set.";
    return sailup(key, sender);
  }
  if (name === "arkesel") {
    const key = Deno.env.get("ARKESEL_API_KEY");
    if (!key) return "ARKESEL_API_KEY must be set.";
    return arkesel(key, sender);
  }
  return `Unknown SMS_PROVIDER "${name}".`;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);

  const secret = Deno.env.get("CRON_SECRET");
  const given = request.headers.get("x-cron-secret") ?? "";
  if (!secret || !sameSecret(given, secret)) return json({ error: "Not allowed." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Server is not configured." }, 500);

  const provider = chooseProvider();
  if (typeof provider === "string") return json({ error: provider }, 500);

  const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const started = Date.now();
  let sent = 0;
  let failed = 0;

  // Batches of 50 until nothing is due or 40 seconds have passed (the next run picks up the rest).
  while (Date.now() - started < 40000) {
    const { data, error } = await db.rpc("claim_sms", { p_limit: 50 });
    if (error) return json({ error: "Could not read the outbox.", sent, failed }, 500);
    const batch = Array.isArray(data) ? data.filter(isDue) : [];
    if (batch.length === 0) break;

    // A few at a time, to stay within the provider's rate limits.
    for (let i = 0; i < batch.length; i += 5) {
      const group = batch.slice(i, i + 5);
      const results = await Promise.all(group.map((sms) => provider(sms)));
      await Promise.all(
        group.map((sms, index) => {
          const result = results[index];
          if (result.ok) sent++;
          else failed++;
          return db.rpc("finish_sms", {
            p_id: sms.id,
            p_ok: result.ok,
            p_provider_id: result.ok ? result.providerId : null,
            p_error: result.ok ? null : result.error,
          });
        }),
      );
    }
  }

  return json({ sent, failed });
});
