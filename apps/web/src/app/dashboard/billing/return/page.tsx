import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { callPaystack } from "@/lib/paystack";

export const metadata: Metadata = { title: "Payment" };

/**
 * Paystack sends the admin back here with the payment's reference. RollCol
 * asks Paystack itself whether it was paid (never trusting the address), then
 * returns to the Billing page.
 */
export default async function PaymentReturnPage({ searchParams }: PageProps<"/dashboard/billing/return">) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const reference = typeof params.reference === "string" ? params.reference : typeof params.trxref === "string" ? params.trxref : "";
  if (!/^RC[0-9A-Z]{6,30}$/.test(reference)) redirect("/dashboard/billing");

  const result = await callPaystack(supabase, { action: "verify", reference });
  // When the check itself fails, the Billing page checks again and shows why.
  const status = result.ok ? result.data.status : "pending";
  redirect(
    status === "paid" || status === "already_paid"
      ? "/dashboard/billing?paid=1"
      : status === "pending"
        ? "/dashboard/billing?paid=pending"
        : "/dashboard/billing?paid=failed",
  );
}
