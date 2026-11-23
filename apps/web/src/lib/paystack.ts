import "server-only";
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

type PaystackRequest = { action: "initialize"; purchaseId: string } | { action: "verify"; reference: string };

export interface PaystackReply {
  authorizationUrl?: string;
  status?: string;
  message?: string;
}

export type PaystackResult = { ok: true; data: PaystackReply } | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Calls the paystack Edge Function and always returns the real reason when it
 * fails, so the admin (and the guide) can see what went wrong instead of a
 * generic message.
 */
export async function callPaystack(supabase: Client, body: PaystackRequest): Promise<PaystackResult> {
  const { data, error } = await supabase.functions.invoke<PaystackReply>("paystack", { body });
  if (!error) return { ok: true, data: data ?? {} };

  if (error instanceof FunctionsHttpError) {
    const response: unknown = error.context;
    if (response instanceof Response) {
      const text = await response.text().catch(() => "");
      let message = "";
      try {
        const parsed: unknown = JSON.parse(text);
        if (isRecord(parsed) && typeof parsed.error === "string") message = parsed.error;
        else if (isRecord(parsed) && typeof parsed.message === "string") message = parsed.message;
      } catch {
        message = text.slice(0, 200);
      }
      if (response.status === 404 && !message) {
        return { ok: false, message: "The paystack Edge Function is not deployed on this Supabase project." };
      }
      return { ok: false, message: message || `The payment service answered with error ${response.status}.` };
    }
  }
  if (error instanceof FunctionsRelayError) {
    return { ok: false, message: "Supabase could not reach the paystack Edge Function. Check that it is deployed." };
  }
  if (error instanceof FunctionsFetchError) {
    return { ok: false, message: "This server could not reach Supabase. Check the internet connection and try again." };
  }
  return { ok: false, message: error.message };
}
