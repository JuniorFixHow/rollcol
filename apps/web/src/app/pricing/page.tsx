import { type BillingCatalog, PLAN_INFO, formatCedis } from "@rollcol/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { LinkButton } from "@/components/ui";
import { getCatalog } from "@/lib/billing";

export const metadata: Metadata = {
  title: "Pricing",
  description: "RollCol prices for schools, colleges and teachers: free to start, then a small amount per student per term.",
};

function Check() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M4.5 10.5 8.5 14l7-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlanCard({
  name,
  price,
  unit,
  summary,
  features,
  highlight = false,
}: {
  name: string;
  price: string;
  unit?: string;
  summary: string;
  features: string[];
  highlight?: boolean;
}) {
  return (
    <div className={`flex flex-col rounded-xl border p-6 ${highlight ? "border-accent shadow-sm ring-1 ring-accent" : "border-line"} bg-surface`}>
      <h3 className="font-semibold">{name}</h3>
      <p className="mt-3">
        <span className="text-3xl font-semibold tracking-tight">{price}</span>
        {unit ? <span className="ml-1 text-sm text-muted">{unit}</span> : null}
      </p>
      <p className="mt-2 text-sm text-muted">{summary}</p>
      <ul className="mt-5 space-y-2 text-sm">
        {features.map((feature) => (
          <li key={feature} className="flex gap-2">
            <Check />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-2xl text-muted">{description}</p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">{children}</div>
    </section>
  );
}

function Plans({ catalog }: { catalog: BillingCatalog }) {
  const per = (code: keyof BillingCatalog["prices"], word: string) => [formatCedis(catalog.prices[code]), `per student per ${word}`] as const;
  const [alertsPrice, alertsUnit] = per("alerts", "term");
  const [completePrice, completeUnit] = per("complete", "term");
  const [standardPrice, standardUnit] = per("standard", "semester");
  const [wsAlertsPrice, wsAlertsUnit] = per("workspace_alerts", "term");
  const [wsStandardPrice, wsStandardUnit] = per("workspace_standard", "semester");
  const weeks = Math.round(catalog.trialDays / 7);

  return (
    <div className="space-y-16">
      <Section
        id="schools"
        title="Basic and senior high schools"
        description={`Teachers mark registers on the phone or the website; guardians get an SMS when a child is absent or late. Every new school gets ${weeks} weeks of Complete free once RollCol verifies it.`}
      >
        <PlanCard
          name="Free"
          price="GHS 0"
          summary="Registers and records, without attendance SMS."
          features={[
            `Up to ${catalog.free.non_tertiary} students`,
            "Daily or lesson-by-lesson registers, also offline",
            "Reports, the GES attendance line, Excel and PDF",
            "System SMS to guardians (added or removed), free",
          ]}
        />
        <PlanCard name="Alerts" price={alertsPrice} unit={alertsUnit} summary={PLAN_INFO.alerts.summary} features={PLAN_INFO.alerts.features} highlight />
        <PlanCard
          name="Complete"
          price={completePrice}
          unit={completeUnit}
          summary={PLAN_INFO.complete.summary}
          features={[
            "Everything in Alerts",
            "A daily present SMS to one chosen guardian per student",
            `${catalog.completeCreditsPerStudent} SMS credits per student for broadcasts and messages`,
          ]}
        />
      </Section>

      <Section
        id="tertiary"
        title="Universities, colleges and nursing schools"
        description="Students check in on their own phones with the RollCol app: location, a rotating QR code and Face ID or fingerprint. Every anti-cheat check is in every plan."
      >
        <PlanCard
          name="Free"
          price="GHS 0"
          summary="Everything, for smaller colleges."
          features={[
            `Up to ${catalog.free.tertiary} students`,
            "Self check-in with location, rotating QR and phone binding",
            "Venues, live counts, reports and downloads",
          ]}
        />
        <PlanCard
          name="Standard"
          price={standardPrice}
          unit={standardUnit}
          summary={PLAN_INFO.standard.summary}
          features={PLAN_INFO.standard.features}
          highlight
        />
      </Section>

      <Section
        id="workspaces"
        title="Teachers and lecturers on their own"
        description="No school on RollCol yet? Start your own workspace for your classes or courses. It can move into your school later, with all its records."
      >
        <PlanCard
          name="Free workspace"
          price="GHS 0"
          summary="For one teacher or lecturer."
          features={[`Up to ${catalog.free.workspace} students across your workspaces`, "Registers or check-in, reports and downloads", "No SMS"]}
        />
        <PlanCard
          name="Classes: Alerts"
          price={wsAlertsPrice}
          unit={wsAlertsUnit}
          summary={PLAN_INFO.workspace_alerts.summary}
          features={PLAN_INFO.workspace_alerts.features}
          highlight
        />
        <PlanCard
          name="Courses: Standard"
          price={wsStandardPrice}
          unit={wsStandardUnit}
          summary={PLAN_INFO.workspace_standard.summary}
          features={PLAN_INFO.workspace_standard.features}
        />
      </Section>

      <section id="sms" className="scroll-mt-6">
        <h2 className="text-2xl font-semibold tracking-tight">SMS credits</h2>
        <p className="mt-2 max-w-2xl text-muted">
          For broadcasts and messages to guardians, on any plan that sends SMS. One credit sends one SMS of up to 160 characters.
          Attendance alerts on your plan never use credits.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {catalog.packs.map((pack) => (
            <div key={pack.credits} className="rounded-xl border border-line bg-surface p-5">
              <p className="text-lg font-semibold">{pack.credits.toLocaleString("en-GH")} credits</p>
              <p className="text-muted">{formatCedis(pack.price)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const QUESTIONS: { q: string; a: string }[] = [
  {
    q: "Who counts as a student?",
    a: "Every student or pupil who is turned on in RollCol. Students who have left can be turned off; they keep their records and stop counting.",
  },
  {
    q: "When do we pay?",
    a: "Once for each term or semester, for the students you have. If more join later, you pay for the extra places for the rest of that term. You can pay ahead for the next term too.",
  },
  {
    q: "How do we pay?",
    a: "On the Billing page, with Mobile Money or a card, through Paystack. A receipt is ready as soon as the payment goes through.",
  },
  {
    q: "What happens when a term ends?",
    a: "Your school goes back to the free plan until you pay for the next term. Nothing is deleted; only adding students beyond the free limit, and the alerts of a paid plan, stop.",
  },
  {
    q: "Is the free trial automatic?",
    a: "Yes. Basic and senior high schools get everything in Complete for the first weeks after RollCol verifies them, with no payment details needed.",
  },
  {
    q: "Do the apps cost anything?",
    a: "No. The RollCol app for teachers, lecturers and students is free, and never asks for payment.",
  },
];

/** Prices come from the database when someone visits (cached for an hour), never at build time. */
async function LivePlans() {
  await connection();
  const catalog = await getCatalog();
  return <Plans catalog={catalog} />;
}

function PlansLoading() {
  return (
    <div className="grid gap-4 md:grid-cols-3" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-72 animate-pulse rounded-xl bg-surface-muted" />
      ))}
    </div>
  );
}

export default function PricingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-20">
        <div className="py-10 sm:py-14">
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">Free to start. Then a little per student.</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            Prices in Ghana cedis, paid once per term or semester. Every feature is in every plan; plans differ by how many
            students you have and the SMS your school sends.
          </p>
          <nav className="mt-6 flex flex-wrap gap-2 text-sm" aria-label="Jump to">
            {[
              ["#schools", "Basic and SHS"],
              ["#tertiary", "Universities and colleges"],
              ["#workspaces", "Teachers on their own"],
              ["#sms", "SMS credits"],
              ["#questions", "Questions"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="rounded-full border border-line px-3 py-1 text-muted hover:text-foreground">
                {label}
              </a>
            ))}
          </nav>
        </div>

        <Suspense fallback={<PlansLoading />}>
          <LivePlans />
        </Suspense>

        <section id="questions" className="mt-16 scroll-mt-6">
          <h2 className="text-2xl font-semibold tracking-tight">Questions</h2>
          <dl className="mt-6 grid gap-6 md:grid-cols-2">
            {QUESTIONS.map((item) => (
              <div key={item.q}>
                <dt className="font-medium">{item.q}</dt>
                <dd className="mt-1 text-sm text-muted">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-16 rounded-xl bg-surface-muted p-8 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Start free today</h2>
          <p className="mt-2 text-muted">No payment details needed. Choose a plan when you are ready.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <LinkButton href="/sign-up">Register your school</LinkButton>
            <LinkButton href="/sign-up/workspace" variant="secondary">
              Start a workspace
            </LinkButton>
          </div>
          <p className="mt-4 text-sm text-muted">
            Already using RollCol? Admins choose a plan on the{" "}
            <Link href="/dashboard/billing" className="text-accent hover:underline">
              Billing page
            </Link>
            .
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
