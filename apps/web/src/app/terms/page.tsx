import { SUPPORT_EMAIL } from "@rollcol/shared";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The terms for using RollCol, the school attendance service by Teqxa.",
};

const LAST_UPDATED = "23 November 2026";

const SECTIONS = [
  { id: "agreement", title: "Agreeing to these terms" },
  { id: "service", title: "What RollCol is" },
  { id: "accounts", title: "Accounts" },
  { id: "schools", title: "Schools' responsibilities" },
  { id: "students", title: "Students and check-in" },
  { id: "use", title: "Acceptable use" },
  { id: "plans", title: "Plans, payments and refunds" },
  { id: "sms", title: "SMS messages" },
  { id: "availability", title: "Availability and changes to RollCol" },
  { id: "ownership", title: "Ownership" },
  { id: "ending", title: "Suspending or ending use" },
  { id: "liability", title: "Warranties and liability" },
  { id: "changes", title: "Changes to these terms" },
  { id: "law", title: "Governing law" },
  { id: "contact", title: "Contact us" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function Section({ id, children }: { id: SectionId; children: ReactNode }) {
  const title = SECTIONS.find((section) => section.id === id)?.title ?? "";
  return (
    <section id={id} className="scroll-mt-6 space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default function TermsPage() {
  const mail = (
    <a className="font-medium text-accent hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
      {SUPPORT_EMAIL}
    </a>
  );
  const privacy = (
    <Link className="font-medium text-accent hover:underline" href="/privacy">
      privacy policy
    </Link>
  );

  return (
    <>
      <SiteHeader />
      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-6">
        <article className="space-y-10 text-[15px] leading-7 text-foreground/90 [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
          <header className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Terms of use</h1>
            <p className="text-sm text-muted">Last updated {LAST_UPDATED}</p>
            <p>
              These terms apply to the RollCol website and the RollCol mobile app for iPhone and Android. Please read them
              with our {privacy}, which explains how information is handled.
            </p>
          </header>

          <nav aria-label="On this page" className="rounded-lg border border-line bg-surface p-5">
            <p className="mb-2 text-sm font-semibold text-foreground">On this page</p>
            <ol className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {SECTIONS.map((section, index) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="text-accent hover:underline">
                    {index + 1}. {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <Section id="agreement">
            <p>
              RollCol is a product of Teqxa, based in Accra, Ghana (&quot;we&quot;, &quot;us&quot;). By creating an account
              or using RollCol, you agree to these terms. If you register a school or a workspace, you also agree to them on
              behalf of that school, and you confirm that you are allowed to do so.
            </p>
            <p>If you do not agree, do not use RollCol.</p>
          </Section>

          <Section id="service">
            <p>RollCol helps schools in Ghana take attendance:</p>
            <ul>
              <li>basic and senior high schools keep class registers and can send SMS alerts to parents and guardians;</li>
              <li>
                universities, colleges and polytechnics run check-in sessions that students join on their phones, at the
                venue;
              </li>
              <li>
                a teacher or lecturer can also use a personal workspace for their own classes or courses, outside a school
                account.
              </li>
            </ul>
          </Section>

          <Section id="accounts">
            <ul>
              <li>Give accurate details, and keep them up to date under Your account.</li>
              <li>
                Keep your password to yourself. You are responsible for what happens under your account. Tell us at once
                at {mail} if you think someone else has used it.
              </li>
              <li>One account is for one person. Do not share it, and do not sign in as someone else.</li>
              <li>You can delete your account at any time from Your account, on the website or in the app.</li>
            </ul>
          </Section>

          <Section id="schools">
            <p>A school, or a workspace owner, that uses RollCol is responsible for:</p>
            <ul>
              <li>
                having a lawful reason under the Data Protection Act, 2012 (Act 843) to record its students, staff and
                guardians in RollCol, and telling them about it;
              </li>
              <li>the accuracy of the students, classes, guardians and phone numbers it adds;</li>
              <li>who it invites as staff and which roles it gives them;</li>
              <li>the attendance records it keeps, and the decisions it makes with them.</li>
            </ul>
            <p>
              The school controls this information. We process it on the school&apos;s behalf to provide RollCol, as the
              privacy policy describes.
            </p>
          </Section>

          <Section id="students">
            <p>
              Tertiary students check in with the RollCol app. A check-in records that the phone registered to the student
              was at the venue during the session. Students agree:
            </p>
            <ul>
              <li>to check in only for themselves, and only when they are actually present;</li>
              <li>not to share session codes with anyone who is not present;</li>
              <li>
                not to fake their location, use another student&apos;s phone, or otherwise get around the check-in rules.
              </li>
            </ul>
            <p>Schools may treat a breach of these rules under their own disciplinary rules.</p>
          </Section>

          <Section id="use">
            <p>You must not:</p>
            <ul>
              <li>use RollCol for anything unlawful, or to harass, mislead or harm anyone;</li>
              <li>send SMS messages that are not about the school&apos;s students and attendance;</li>
              <li>add someone&apos;s phone number without a proper reason to contact them about a student;</li>
              <li>try to get into accounts, schools or information that are not yours;</li>
              <li>test, scan, overload or disrupt RollCol, or copy it with automated tools;</li>
              <li>copy, resell or rebuild RollCol, or remove its notices.</li>
            </ul>
          </Section>

          <Section id="plans">
            <ul>
              <li>
                RollCol has free limits and paid plans, shown on the{" "}
                <Link className="font-medium text-accent hover:underline" href="/pricing">
                  pricing page
                </Link>
                . A verified school may get a free trial of a paid plan.
              </li>
              <li>
                A plan is paid in advance for one term or semester, for the number of students chosen. More students can be
                added later for the same term or semester. Plans do not renew by themselves.
              </li>
              <li>
                Payments are made through Paystack, by card or Mobile Money, in Ghana cedis. We do not see or store card
                details. A plan or credits are added once Paystack confirms the payment.
              </li>
              <li>
                Payments are not refundable once a plan has started or credits have been used, unless the law requires
                it. If you were charged by mistake, or twice for the same thing, email {mail} within 30 days and we will
                put it right.
              </li>
              <li>SMS credits belong to the school that bought them and cannot be moved to another school or exchanged for cash.</li>
              <li>
                We may change prices. A change does not affect a term or semester you have already paid for, and we will
                show the new prices before you pay.
              </li>
            </ul>
          </Section>

          <Section id="sms">
            <p>
              RollCol sends SMS messages on behalf of schools, through SMS providers in Ghana. Delivery depends on the
              mobile networks and the recipient&apos;s phone, so we cannot promise that every message arrives or arrives on
              time. A school should not rely on RollCol SMS alone for urgent safety matters.
            </p>
            <p>A guardian can ask the school to stop SMS messages at any time.</p>
          </Section>

          <Section id="availability">
            <p>
              We work to keep RollCol available and to protect it, but it may sometimes be unavailable, for example for
              maintenance or because of problems outside our control. The app keeps registers on the phone while it is
              offline and sends them later.
            </p>
            <p>
              We improve RollCol over time and may add, change or remove features. If a change takes away something a
              school has paid for, we will tell the school and offer a fair solution.
            </p>
          </Section>

          <Section id="ownership">
            <p>
              RollCol, its name, design and software belong to Teqxa. Using RollCol does not give you any rights in them,
              apart from using it under these terms.
            </p>
            <p>
              Schools keep the information they put into RollCol. They can download their reports at any time while they
              use RollCol.
            </p>
          </Section>

          <Section id="ending">
            <ul>
              <li>You can stop using RollCol and delete your account at any time.</li>
              <li>
                We may suspend or close an account or a school that breaks these terms, puts other people at risk, or is
                not a genuine school. Where we can, we will warn first and give a chance to put things right.
              </li>
              <li>
                When a school stops using RollCol, we keep and delete its information as the privacy policy describes.
              </li>
            </ul>
          </Section>

          <Section id="liability">
            <p>
              RollCol is provided as it is. Attendance records are only as accurate as the registers, check-ins and
              details entered into it, so schools should check the records they rely on.
            </p>
            <p>
              As far as the law allows, we are not responsible for indirect losses, such as lost profits or lost
              opportunities, and our total responsibility to a school for any claim is limited to what that school paid us
              in the 12 months before the claim. Nothing in these terms limits responsibility that cannot be limited under
              the laws of Ghana.
            </p>
          </Section>

          <Section id="changes">
            <p>
              We will update these terms when RollCol changes. The date at the top shows the latest version. For important
              changes, we will tell schools before they take effect. Using RollCol after that means you accept the new
              terms.
            </p>
          </Section>

          <Section id="law">
            <p>
              These terms are governed by the laws of the Republic of Ghana. We will first try to settle any disagreement
              with you directly. If that fails, the courts of Ghana will decide it.
            </p>
          </Section>

          <Section id="contact">
            <p>Questions about these terms: {mail}.</p>
          </Section>
        </article>
      </div>
      <SiteFooter />
    </>
  );
}
