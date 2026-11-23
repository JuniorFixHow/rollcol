import { z } from "zod";

/** The price list from the database (public.billing_catalog). Amounts are in pesewas. */
export const billingCatalogSchema = z.object({
  currency: z.string(),
  trialDays: z.number(),
  completeCreditsPerStudent: z.number(),
  free: z.object({ non_tertiary: z.number(), tertiary: z.number(), workspace: z.number() }),
  prices: z.object({
    alerts: z.number(),
    complete: z.number(),
    standard: z.number(),
    workspace_alerts: z.number(),
    workspace_standard: z.number(),
  }),
  packs: z.array(z.object({ credits: z.number(), price: z.number() })),
});

export type BillingCatalog = z.output<typeof billingCatalogSchema>;

export const PLAN_CODES = ["alerts", "complete", "standard", "workspace_alerts", "workspace_standard"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export function isPlanCode(value: unknown): value is PlanCode {
  return typeof value === "string" && (PLAN_CODES as readonly string[]).includes(value);
}

/** What each plan is called and gives, for the Pricing and Billing pages. */
export const PLAN_INFO: Record<PlanCode, { name: string; per: "term" | "semester"; summary: string; features: string[] }> = {
  alerts: {
    name: "Alerts",
    per: "term",
    summary: "Guardians are told by SMS when a child is absent or late.",
    features: [
      "As many students as you pay for",
      "Absence and late SMS to guardians",
      "A follow-up SMS when an absent child arrives",
      "Everything in the free plan",
    ],
  },
  complete: {
    name: "Complete",
    per: "term",
    summary: "Alerts, plus a daily present SMS and SMS credits for messages.",
    features: [
      "Everything in Alerts",
      "A daily present SMS to one chosen guardian per student",
      "SMS credits included for broadcasts and messages",
    ],
  },
  standard: {
    name: "Standard",
    per: "semester",
    summary: "For colleges and universities with more students.",
    features: ["As many students as you pay for", "Everything in the free plan, including every anti-cheat check"],
  },
  workspace_alerts: {
    name: "Alerts",
    per: "term",
    summary: "More students, and SMS to guardians from your own workspace.",
    features: [
      "As many students as you pay for, in this workspace",
      "Absence and late SMS to guardians",
      "SMS credits can be bought for messages",
    ],
  },
  workspace_standard: {
    name: "Standard",
    per: "semester",
    summary: "More students in your own courses workspace.",
    features: ["As many students as you pay for, in this workspace", "Everything in the free plan"],
  },
};

/** "GHS 3", "GHS 1,234.50". */
export function formatCedis(pesewas: number): string {
  const cedis = pesewas / 100;
  return `GHS ${cedis.toLocaleString("en-GH", {
    minimumFractionDigits: Number.isInteger(cedis) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
