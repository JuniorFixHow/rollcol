import { PLAN_INFO, type PlanCode, formatCedis, isPlanCode, periodWord } from "@rollcol/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, FormMessage, SubmitButton, TextField } from "@/components/form";
import { Badge, Card, EmptyState, Notice, PageHeader, Table, Td, formatDate, formatDateTime, formatLongDate } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { getCatalog } from "@/lib/billing";
import { startPurchase } from "./actions";
import { PlanPicker } from "./plan-picker";

export const metadata: Metadata = { title: "Billing" };

const STATUS_TONE = { paid: "success", pending: "neutral", failed: "danger" } as const;

function dates(from: string, to: string) {
  return `${formatDate(from)} to ${formatDate(to)}`;
}

export default async function BillingPage({ searchParams }: PageProps<"/dashboard/billing">) {
  const params = await searchParams;
  const { supabase, member } = await requireAdmin();
  const { school } = member;
  const word = periodWord(school.type);
  const today = new Date().toISOString().slice(0, 10);

  const [catalog, billingResult, periodsResult, plansResult, purchasesResult] = await Promise.all([
    getCatalog(),
    supabase.rpc("school_billing", { p_school_id: school.id }),
    supabase
      .from("academic_periods")
      .select("id, name, starts_on, ends_on")
      .eq("school_id", school.id)
      .gte("ends_on", today)
      .order("starts_on"),
    supabase.from("school_plans").select("academic_period_id, plan, students_paid").eq("school_id", school.id),
    supabase
      .from("billing_purchases")
      .select("id, description, amount, status, created_at, paid_at, receipt_number, channel, failure, created_by_name")
      .eq("school_id", school.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const billing = billingResult.data?.[0];
  if (!billing) throw new Error(billingResult.error?.message ?? "Billing could not be loaded.");

  const plans = billing.plans.filter(isPlanCode);
  const paidPeriods = new Map((plansResult.data ?? []).map((p) => [p.academic_period_id, p]));
  const unpaidPeriods = (periodsResult.data ?? []).filter((p) => !paidPeriods.has(p.id));
  const current = billing.plan && isPlanCode(billing.plan) ? billing.plan : null;
  const currentPeriodId = (periodsResult.data ?? []).find((p) => p.starts_on <= today && today <= p.ends_on)?.id;
  const canBuy = school.isWorkspace || school.status === "verified";
  const onTrial = !current && billing.trial_ends_on !== null && billing.trial_ends_on >= today;
  const freeLimit = school.isWorkspace ? catalog.free.workspace : school.type === "tertiary" ? catalog.free.tertiary : catalog.free.non_tertiary;
  const purchases = purchasesResult.data ?? [];

  const planTitle = current
    ? `${PLAN_INFO[current].name} plan`
    : onTrial
      ? "Free trial"
      : school.isWorkspace
        ? "Free workspace"
        : "Free plan";

  return (
    <>
      <PageHeader
        title="Billing"
        description={
          <>
            Plans are paid per student, once per {word}.{" "}
            <Link href="/pricing" className="text-accent hover:underline">
              See all prices
            </Link>
          </>
        }
      />

      <div className="space-y-6">
        {params.paid === "1" ? (
          <Notice tone="success" title="Payment received">
            Thank you. Your receipt is in the list below.
          </Notice>
        ) : null}
        {params.paid === "pending" ? (
          <Notice title="Waiting for Paystack">
            Paystack has not confirmed the payment yet. Mobile Money can take a minute; this page shows it as paid once it is.
          </Notice>
        ) : null}
        {params.paid === "failed" ? (
          <Notice tone="warning" title="The payment did not go through">
            Nothing was charged. You can try again.
          </Notice>
        ) : null}

        <Card title={planTitle}>
          <div className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-muted">Students</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {billing.students_used}
                {billing.student_limit ? <span className="text-base font-normal text-muted"> of {billing.student_limit}</span> : null}
              </p>
              {school.isWorkspace && !current ? <p className="text-xs text-muted">Across all your free workspaces</p> : null}
            </div>
            <div>
              <p className="text-muted">{current ? `Paid for` : onTrial ? "Trial ends" : "Plan"}</p>
              <p className="mt-1 font-medium">
                {current && billing.starts_on && billing.ends_on
                  ? `${billing.period_name} (${dates(billing.starts_on, billing.ends_on)})`
                  : onTrial && billing.trial_ends_on
                    ? formatLongDate(billing.trial_ends_on)
                    : `Free, up to ${freeLimit} students`}
              </p>
            </div>
            <div>
              <p className="text-muted">SMS</p>
              <p className="mt-1 font-medium">
                {!billing.sms_allowed
                  ? school.isWorkspace
                    ? "Not on free workspaces"
                    : "After verification"
                  : billing.present_alerts
                    ? "Absence, late and present alerts"
                    : billing.absence_alerts
                      ? "Absence and late alerts"
                      : "System messages only"}
              </p>
              {billing.sms_allowed ? <p className="text-xs text-muted">{billing.sms_credits} SMS credits left</p> : null}
            </div>
          </div>
          {onTrial ? (
            <p className="mt-4 text-sm text-muted">
              During the trial your school gets everything in Complete, for up to {freeLimit} students. Choose a plan before{" "}
              {billing.trial_ends_on ? formatLongDate(billing.trial_ends_on) : "it ends"} to keep the alerts.
            </p>
          ) : null}
        </Card>

        {!canBuy ? (
          <Notice title="Plans open after verification">
            RollCol checks every new school first. Until then your school stays on the free limits, and you can see the prices on the{" "}
            <Link href="/pricing" className="font-medium text-accent hover:underline">
              Pricing page
            </Link>
            .
          </Notice>
        ) : null}

        {canBuy && current && currentPeriodId ? (
          <Card
            title={`Change this ${word}'s plan`}
            description={`You paid for ${billing.students_paid} students for ${billing.period_name}. New students beyond that need a place first.`}
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <ActionForm action={startPurchase} className="space-y-3">
                <input type="hidden" name="kind" value="seats" />
                <input type="hidden" name="periodId" value={currentPeriodId} />
                <TextField
                  name="students"
                  label="More students"
                  type="number"
                  inputMode="numeric"
                  hint={`${formatCedis(catalog.prices[current])} each, for the rest of ${billing.period_name}.`}
                />
                <FormMessage />
                <SubmitButton variant="secondary" pendingLabel="Opening Paystack...">
                  Pay for more students
                </SubmitButton>
              </ActionForm>
              {current === "alerts" && billing.students_paid ? (
                <ActionForm action={startPurchase} className="space-y-3">
                  <input type="hidden" name="kind" value="upgrade" />
                  <input type="hidden" name="periodId" value={currentPeriodId} />
                  <p className="text-sm font-medium">Upgrade to Complete</p>
                  <p className="text-sm text-muted">
                    Adds the daily present SMS and {billing.students_paid * catalog.completeCreditsPerStudent} SMS credits.{" "}
                    {formatCedis(billing.students_paid * (catalog.prices.complete - catalog.prices.alerts))} for{" "}
                    {billing.students_paid} students.
                  </p>
                  <FormMessage />
                  <SubmitButton variant="secondary" pendingLabel="Opening Paystack...">
                    Upgrade to Complete
                  </SubmitButton>
                </ActionForm>
              ) : null}
            </div>
          </Card>
        ) : null}

        {canBuy ? (
          <Card
            title={current ? `Pay for another ${word}` : "Choose a plan"}
            description={
              current
                ? `Pay ahead for the next ${word}, so nothing stops when this one ends.`
                : `Your plan covers the ${word} you choose, from its first to its last day.`
            }
          >
            {unpaidPeriods.length === 0 ? (
              <EmptyState>
                {(periodsResult.data ?? []).length === 0
                  ? `Add the current ${word} under Academics first.`
                  : `Every ${word} you have added is paid for. Add the next ${word} under Academics to pay ahead.`}
              </EmptyState>
            ) : (
              <PlanPicker
                plans={plans}
                prices={catalog.prices satisfies Record<PlanCode, number>}
                periods={unpaidPeriods.map((p) => ({ id: p.id, name: p.name, dates: dates(p.starts_on, p.ends_on) }))}
                activeStudents={billing.students_used}
                creditsPerStudent={catalog.completeCreditsPerStudent}
                word={word}
              />
            )}
          </Card>
        ) : null}

        {billing.sms_allowed ? (
          <Card
            title="SMS credits"
            description="For broadcasts and messages to guardians. One credit sends one SMS (up to 160 characters). Alerts on your plan do not use credits."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              {catalog.packs.map((pack) => (
                <ActionForm key={pack.credits} action={startPurchase} className="rounded-lg border border-line p-4">
                  <input type="hidden" name="kind" value="credits" />
                  <input type="hidden" name="students" value={pack.credits} />
                  <p className="text-lg font-semibold">{pack.credits.toLocaleString("en-GH")} credits</p>
                  <p className="text-sm text-muted">{formatCedis(pack.price)}</p>
                  <div className="mt-3">
                    <SubmitButton size="sm" variant="secondary" pendingLabel="Opening...">
                      Buy
                    </SubmitButton>
                  </div>
                  <FormMessage />
                </ActionForm>
              ))}
            </div>
          </Card>
        ) : null}

        <Card title="Payments">
          {purchases.length === 0 ? (
            <EmptyState>No payments yet.</EmptyState>
          ) : (
            <Table headers={["Date", "For", "Amount", "Status", ""]}>
              {purchases.map((p) => (
                <tr key={p.id}>
                  <Td className="whitespace-nowrap">{formatDateTime(p.paid_at ?? p.created_at)}</Td>
                  <Td>
                    {p.description}
                    <span className="block text-xs text-muted">By {p.created_by_name}</span>
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">{formatCedis(p.amount)}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[p.status === "paid" || p.status === "failed" ? p.status : "pending"]}>
                      {p.status === "pending" ? "Not completed" : p.status === "paid" ? "Paid" : "Failed"}
                    </Badge>
                    {p.failure ? <span className="block text-xs text-muted">{p.failure}</span> : null}
                  </Td>
                  <Td>
                    {p.receipt_number ? (
                      <Link href={`/dashboard/billing/receipts/${p.id}`} className="text-accent hover:underline">
                        Receipt
                      </Link>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
