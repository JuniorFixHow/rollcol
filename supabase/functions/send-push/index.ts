// Sends due push notifications (push_outbox) through Expo's push service.
// Called every minute by the database (pg_net) when something is waiting.
// Deploy: pnpm exec supabase functions deploy send-push --no-verify-jwt
//
// Secrets (Supabase dashboard > Edge Functions > Secrets):
//   CRON_SECRET          the same value as cron_secret in private.config (shared with send-sms)
//   EXPO_ACCESS_TOKEN    optional; needed only if "enhanced push security" is on in your Expo account
import { createClient } from "npm:@supabase/supabase-js@2.119.2";

type Due = { id: number; push_token: string; title: string; body: string; data: Record<string, unknown> };

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

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
  const value = asRecord(row);
  return (
    typeof value.id === "number" &&
    typeof value.push_token === "string" &&
    typeof value.title === "string" &&
    typeof value.body === "string"
  );
}

type Outcome = { ok: true; ticket: string } | { ok: false; error: string };

// Up to 100 messages per request. Each gets its own result, in order.
async function sendBatch(batch: Due[], accessToken: string | undefined): Promise<Outcome[]> {
  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(
        batch.map((push) => ({
          to: push.push_token,
          title: push.title,
          body: push.body,
          data: asRecord(push.data),
          sound: "default",
          priority: "high",
        })),
      ),
      signal: AbortSignal.timeout(20000),
    });
    const parsed = asRecord(await response.json().catch(() => ({})));
    const results = Array.isArray(parsed.data) ? parsed.data : [];
    if (!response.ok || results.length !== batch.length) {
      const reason = `Expo ${response.status}`;
      return batch.map(() => ({ ok: false, error: reason }));
    }
    return results.map((item) => {
      const result = asRecord(item);
      if (result.status === "ok" && typeof result.id === "string") return { ok: true, ticket: result.id };
      const details = asRecord(result.details);
      const code = typeof details.error === "string" ? details.error : null;
      const message = typeof result.message === "string" ? result.message : "Expo refused the notification.";
      return { ok: false, error: code ?? message };
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Could not reach Expo.";
    return batch.map(() => ({ ok: false, error: reason }));
  }
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);

  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || !sameSecret(request.headers.get("x-cron-secret") ?? "", secret)) return json({ error: "Not allowed." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Server is not configured." }, 500);
  const accessToken = Deno.env.get("EXPO_ACCESS_TOKEN") || undefined;

  const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const started = Date.now();
  let sent = 0;
  let failed = 0;

  while (Date.now() - started < 40000) {
    const { data, error } = await db.rpc("claim_push", { p_limit: 100 });
    if (error) return json({ error: "Could not read the queue.", sent, failed }, 500);
    const batch = Array.isArray(data) ? data.filter(isDue) : [];
    if (batch.length === 0) break;

    const outcomes = await sendBatch(batch, accessToken);
    await Promise.all(
      batch.map((push, index) => {
        const outcome = outcomes[index] ?? { ok: false, error: "No result." };
        if (outcome.ok) sent++;
        else failed++;
        return db.rpc("finish_push", {
          p_id: push.id,
          p_ok: outcome.ok,
          p_ticket: outcome.ok ? outcome.ticket : null,
          p_error: outcome.ok ? null : outcome.error,
        });
      }),
    );
  }

  return json({ service: "push", sent, failed });
});
