// Payments through Paystack. The secret key lives only here (Edge Function secret).
// Deploy: pnpm exec supabase functions deploy paystack --no-verify-jwt
// Secrets: PAYSTACK_SECRET_KEY (sk_test_... while testing), SITE_URL (https://rollcol.vercel.app)
//
// Three requests:
//   POST {"action":"initialize","purchaseId":"..."}  as the signed-in admin: returns Paystack's payment page address.
//   POST {"action":"verify","reference":"..."}        as the signed-in admin, after Paystack sends them back.
//   POST from Paystack (header x-paystack-signature)   the webhook: charge.success confirms a payment.
// A payment is applied only after Paystack itself says it succeeded, for the exact amount and currency.
import { createClient } from "npm:@supabase/supabase-js@2.119.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

interface PaystackTransaction {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  id: number;
  channel: string;
  paid_at: string | null;
  gateway_response?: string;
}

function isTransaction(value: unknown): value is PaystackTransaction {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Record<string, unknown>;
  return typeof t.status === "string" && typeof t.reference === "string" && typeof t.amount === "number" && typeof t.currency === "string";
}

async function hmacSha512Hex(key: string, body: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);

  const secretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const siteUrl = (Deno.env.get("SITE_URL") ?? "https://rollcol.vercel.app").replace(/\/+$/, "");
  if (!secretKey || !url || !anonKey || !serviceKey) return json({ error: "Payments are not set up yet." }, 500);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  async function apply(transaction: PaystackTransaction): Promise<string> {
    if (transaction.status !== "success") {
      await admin.rpc("mark_purchase_failed", {
        p_reference: transaction.reference,
        p_reason: transaction.gateway_response ?? transaction.status,
      });
      return transaction.status;
    }
    const { data, error } = await admin.rpc("apply_paystack_payment", {
      p_reference: transaction.reference,
      p_amount: transaction.amount,
      p_currency: transaction.currency,
      p_paystack_id: String(transaction.id),
      p_channel: transaction.channel,
      p_paid_at: transaction.paid_at,
    });
    if (error) throw new Error(error.message);
    return typeof data === "string" ? data : "unknown";
  }

  const raw = await request.text();

  // 1. Paystack's webhook: signed with the secret key.
  const signature = request.headers.get("x-paystack-signature");
  if (signature) {
    if (!sameText(await hmacSha512Hex(secretKey, raw), signature)) return json({ error: "Bad signature." }, 401);
    let event: { event?: string; data?: unknown };
    try {
      event = JSON.parse(raw);
    } catch {
      return json({ error: "Not JSON." }, 400);
    }
    if (event.event === "charge.success" && isTransaction(event.data)) {
      try {
        const result = await apply(event.data);
        return json({ received: true, result });
      } catch (caught) {
        // Paystack retries the webhook when it does not get a 200.
        return json({ error: caught instanceof Error ? caught.message : "Could not apply." }, 500);
      }
    }
    return json({ received: true, ignored: event.event ?? "unknown" });
  }

  // 2 and 3. From the website, as the signed-in admin.
  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "Sign in first." }, 401);
  const asUser = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await asUser.auth.getUser();
  if (userError || !userData.user) return json({ error: "Sign in first." }, 401);

  let body: { action?: string; purchaseId?: string; reference?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Not JSON." }, 400);
  }

  if (body.action === "initialize" && typeof body.purchaseId === "string") {
    // The database checks the caller is an admin of the school and the purchase is unpaid.
    const { data: rows, error } = await asUser.rpc("purchase_for_payment", { p_purchase_id: body.purchaseId });
    const purchase = Array.isArray(rows) ? rows[0] : null;
    if (error || !purchase) return json({ error: error?.message ?? "Payment not found." }, 400);

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: purchase.email,
        amount: purchase.amount,
        currency: purchase.currency,
        reference: purchase.reference,
        callback_url: `${siteUrl}/dashboard/billing/return`,
        channels: ["card", "mobile_money"],
        metadata: { purchase_id: body.purchaseId, school_id: purchase.school_id, description: purchase.description },
      }),
    });
    const result: { status?: boolean; message?: string; data?: { authorization_url?: string } } = await response.json();
    if (!response.ok || !result.status || !result.data?.authorization_url) {
      return json({ error: result.message ?? "Paystack did not accept the payment." }, 502);
    }
    return json({ authorizationUrl: result.data.authorization_url });
  }

  if (body.action === "verify" && typeof body.reference === "string") {
    // Only the purchase's own school admins may ask (RLS on billing_purchases).
    const { data: own } = await asUser.from("billing_purchases").select("id").eq("reference", body.reference).maybeSingle();
    if (!own) return json({ error: "Payment not found." }, 404);
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(body.reference)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const result: { status?: boolean; message?: string; data?: unknown } = await response.json();
    if (!response.ok || !result.status || !isTransaction(result.data)) {
      return json({ status: "pending", message: result.message ?? "Paystack has not confirmed this payment yet." });
    }
    if (result.data.status === "abandoned" || result.data.status === "ongoing" || result.data.status === "pending") {
      return json({ status: "pending" });
    }
    try {
      return json({ status: await apply(result.data) });
    } catch (caught) {
      return json({ error: caught instanceof Error ? caught.message : "Could not apply." }, 500);
    }
  }

  return json({ error: "Unknown request." }, 400);
});
