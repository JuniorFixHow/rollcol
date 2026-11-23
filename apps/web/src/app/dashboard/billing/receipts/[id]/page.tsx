import { formatCedis } from "@rollcol/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { PrintButton } from "@/components/print-button";
import { formatDateTime } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Receipt" };

const CHANNELS: Record<string, string> = { mobile_money: "Mobile Money", card: "Card", bank: "Bank", bank_transfer: "Bank transfer", ussd: "USSD" };

/** A receipt to print or save as PDF. */
export default async function ReceiptPage({ params }: PageProps<"/dashboard/billing/receipts/[id]">) {
  const { id } = await params;
  const { supabase, member } = await requireAdmin();
  const { data: p } = await supabase
    .from("billing_purchases")
    .select("description, amount, currency, paid_at, receipt_number, channel, reference, created_by_name, email, students, credits")
    .eq("id", id)
    .eq("school_id", member.school.id)
    .eq("status", "paid")
    .maybeSingle();
  if (!p || !p.receipt_number) notFound();

  return (
    <>
      <style>{"@page { size: A4; margin: 0; }"}</style>
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link href="/dashboard/billing" className="text-sm text-accent hover:underline">
          Back to Billing
        </Link>
        <PrintButton />
      </div>
      <article className="print-report mx-auto max-w-2xl rounded-lg border border-line bg-surface p-8 print:max-w-none print:rounded-none print:border-0">
        <header className="flex items-start justify-between gap-6 border-b border-line pb-5">
          <div>
            <Brand />
            <p className="mt-2 text-xs text-muted">RollCol by Teqxa · teqxa.com</p>
          </div>
          <div className="text-right">
            <h1 className="text-xl font-semibold">Receipt</h1>
            <p className="mt-1 font-mono text-sm">{p.receipt_number}</p>
          </div>
        </header>
        <dl className="mt-6 grid grid-cols-[9rem_1fr] gap-y-2 text-sm">
          <dt className="text-muted">Paid by</dt>
          <dd>
            {member.school.name}
            <span className="block text-muted">
              {p.created_by_name}, {p.email}
            </span>
          </dd>
          <dt className="text-muted">Date</dt>
          <dd>{p.paid_at ? formatDateTime(p.paid_at) : ""}</dd>
          <dt className="text-muted">Paid with</dt>
          <dd>{(p.channel && CHANNELS[p.channel]) ?? p.channel ?? "Paystack"} through Paystack</dd>
          <dt className="text-muted">Reference</dt>
          <dd className="font-mono">{p.reference}</dd>
        </dl>
        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line">
              <td className="py-3">
                {p.description}
                {p.credits ? <span className="block text-muted">{p.credits} SMS credits</span> : null}
              </td>
              <td className="py-3 text-right tabular-nums">{formatCedis(p.amount)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td className="py-3 font-semibold">Total paid ({p.currency})</td>
              <td className="py-3 text-right text-lg font-semibold tabular-nums">{formatCedis(p.amount)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-8 text-xs text-muted">Thank you for using RollCol. Questions about this payment: contact RollCol support.</p>
      </article>
    </>
  );
}
