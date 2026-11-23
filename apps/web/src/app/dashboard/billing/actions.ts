"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { type FormState, failed, formValues } from "@/lib/forms";
import { callPaystack } from "@/lib/paystack";

const KINDS = ["plan", "seats", "upgrade", "credits"] as const;
type Kind = (typeof KINDS)[number];

function isKind(value: unknown): value is Kind {
  return typeof value === "string" && (KINDS as readonly string[]).includes(value);
}

/**
 * Records the purchase (the database works out and checks the amount), then
 * sends the admin to Paystack's payment page. Nothing is paid or changed
 * until Paystack confirms it.
 */
export async function startPurchase(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireAdmin();
  const values = formValues(formData);
  if (!isKind(values.kind)) return failed("Choose what to pay for.");
  const students = values.students ? Number(values.students) : null;
  if (students !== null && (!Number.isInteger(students) || students < 1)) {
    return { status: "error", fieldErrors: { students: "Enter a whole number of students." }, values };
  }

  const { data, error } = await supabase.rpc("create_purchase", {
    p_school_id: member.school.id,
    p_kind: values.kind,
    p_plan: values.plan || null,
    p_period_id: values.periodId || null,
    p_students: students,
  });
  if (error) return failed(error.message, values);
  const purchase = data[0];
  if (!purchase) return failed("We could not start the payment. Please try again.", values);

  const started = await callPaystack(supabase, { action: "initialize", purchaseId: purchase.id });
  if (!started.ok) return failed(`Paystack could not start the payment: ${started.message}`, values);
  const url = started.data.authorizationUrl;
  if (!url || !url.startsWith("https://")) return failed("Paystack did not return a payment page. Please try again.", values);
  redirect(url);
}

export interface PaymentCheck {
  /** Payments Paystack confirmed during this check. */
  applied: number;
  /** Payments Paystack has not finished yet. */
  waiting: number;
  /** Why a check could not be made, if it could not. */
  problem: string | null;
}

/**
 * Asks Paystack about this school's payments from the last two days that are
 * still not completed. A payment is applied here even when Paystack's webhook
 * was late or missing, and nothing is applied unless Paystack confirms it.
 */
export async function checkPendingPayments(): Promise<PaymentCheck> {
  const { supabase, member } = await requireAdmin();
  const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const { data: pending, error } = await supabase
    .from("billing_purchases")
    .select("reference")
    .eq("school_id", member.school.id)
    .eq("status", "pending")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) return { applied: 0, waiting: 0, problem: error.message };

  let applied = 0;
  let waiting = 0;
  let problem: string | null = null;
  for (const { reference } of pending ?? []) {
    const result = await callPaystack(supabase, { action: "verify", reference });
    if (!result.ok) {
      problem = result.message;
      continue;
    }
    if (result.data.status === "paid" || result.data.status === "already_paid") applied += 1;
    else if (result.data.status === "pending") waiting += 1;
  }
  return { applied, waiting, problem };
}
