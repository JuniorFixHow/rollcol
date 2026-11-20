// Receives delivery reports from Sailup (https://www.sailup.io/docs/webhooks)
// and records them on the message in sms_outbox.
// Deploy: pnpm exec supabase functions deploy sms-delivery --no-verify-jwt
//
// In the Sailup dashboard, add a webhook with this function's address and the
// SMS events (message.delivered, message.failed, message.expired, message.rejected).
// Sailup shows a secret once: save it as the Edge Function secret SAILUP_WEBHOOK_SECRET.
import { createClient } from "npm:@supabase/supabase-js@2.119.2";

type Delivery = "delivered" | "failed" | "expired" | "rejected";

const EVENTS: Readonly<Record<string, Delivery>> = {
  "message.delivered": "delivered",
  "message.failed": "failed",
  "message.expired": "expired",
  "message.rejected": "rejected",
};

/** Reports signed more than this long ago are refused, so an old report cannot be replayed. */
const MAX_AGE_MS = 15 * 60 * 1000;

function reply(status: number, message: string): Response {
  return new Response(JSON.stringify({ message }), { status, headers: { "Content-Type": "application/json" } });
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sameText(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let difference = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    difference |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return difference === 0;
}

/** HMAC-SHA256 of "{timestamp}.{raw body}" with the webhook secret, as hex. */
async function expectedSignature(secret: string, timestamp: string, rawBody: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`)));
}

/** Sailup's timestamp as milliseconds, whether sent in seconds, milliseconds or as a date. */
function timestampMs(value: string): number | null {
  if (/^\d+$/.test(value)) {
    const n = Number(value);
    return n < 1e12 ? n * 1000 : n;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return reply(405, "Use POST.");

  const secret = Deno.env.get("SAILUP_WEBHOOK_SECRET");
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || !url || !serviceKey) return reply(500, "Server is not configured.");

  // Verify against the exact bytes received, before parsing.
  const rawBody = await request.text();
  const timestamp = request.headers.get("X-Sailup-Timestamp") ?? "";
  const signature = (request.headers.get("X-Sailup-Signature") ?? "").replace(/^sha256=/, "");
  if (!timestamp || !signature) return reply(401, "Missing signature.");
  if (!sameText(signature, await expectedSignature(secret, timestamp, rawBody))) return reply(401, "Bad signature.");

  const sentAt = timestampMs(timestamp);
  if (sentAt === null || Math.abs(Date.now() - sentAt) > MAX_AGE_MS) return reply(401, "Report is too old.");

  let payload: Record<string, unknown>;
  try {
    payload = asRecord(JSON.parse(rawBody));
  } catch {
    return reply(400, "Not JSON.");
  }

  // Other events (email, sender ID) are acknowledged and ignored.
  const event = typeof payload.event === "string" ? payload.event : "";
  const delivery = EVENTS[event];
  if (!delivery) return reply(200, "Ignored.");

  const data = asRecord(payload.data);
  const id = typeof data.id === "string" ? data.id : typeof data.message_id === "string" ? data.message_id : null;
  if (!id) return reply(400, "No message id.");

  const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await db.rpc("record_sms_delivery", { p_provider_id: id, p_delivery: delivery });
  // A database error returns 500 so Sailup retries later.
  if (error) return reply(500, "Could not record the report.");
  return reply(200, "Recorded.");
});
