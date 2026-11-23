"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { type FormState, failed, formValues } from "@/lib/forms";

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

  const { data: started, error: startError } = await supabase.functions.invoke<{ authorizationUrl?: string; error?: string }>(
    "paystack",
    { body: { action: "initialize", purchaseId: purchase.id } },
  );
  const url = started?.authorizationUrl;
  if (startError || !url || !url.startsWith("https://")) {
    return failed(started?.error ?? "Paystack could not be reached. Please try again in a moment.", values);
  }
  redirect(url);
}
