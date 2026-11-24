import { SUPPORT_EMAIL } from "@rollcol/shared";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How RollCol collects, uses and protects information about schools, staff, students and guardians.",
};

const LAST_UPDATED = "24 November 2026";

const SECTIONS = [
  { id: "who", title: "Who we are" },
  { id: "roles", title: "Schools and RollCol" },
  { id: "collect", title: "What we collect" },
  { id: "location", title: "Location and your device" },
  { id: "use", title: "How we use information" },
  { id: "sms", title: "SMS messages to guardians" },
  { id: "children", title: "Children" },
  { id: "sharing", title: "Who can see it" },
  { id: "storage", title: "Where it is stored and for how long" },
  { id: "security", title: "Security" },
  { id: "rights", title: "Your rights and choices" },
  { id: "changes", title: "Changes to this policy" },
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

export default function PrivacyPage() {
  const mail = (
    <a className="font-medium text-accent hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
      {SUPPORT_EMAIL}
    </a>
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <Brand />
      <article className="mt-8 space-y-10 text-[15px] leading-7 text-foreground/90 [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        <header className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Privacy policy</h1>
          <p className="text-sm text-muted">Last updated {LAST_UPDATED}</p>
          <p>
            RollCol helps schools in Ghana take attendance. Basic and senior high schools use it for class registers and
            SMS alerts to parents and guardians. Universities, colleges and polytechnics use it for check-in sessions that
            students join on their phones. This policy explains what information RollCol handles, why, who can see it,
            and the choices you have.
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

        <Section id="who">
          <p>
            RollCol is a product of Teqxa, based in Accra, Ghana (&quot;we&quot;, &quot;us&quot;). It includes the RollCol
            website and the RollCol mobile app for iPhone and Android.
          </p>
        </Section>

        <Section id="roles">
          <p>
            A school decides to use RollCol and decides whose information goes into it: its staff, its students and their
            guardians. For those school records, the <strong>school is in charge of the information</strong> (the data
            controller) and RollCol processes it on the school&apos;s behalf and on its instructions. For your RollCol
            account itself (your sign-in details and settings), RollCol is responsible.
          </p>
          <p>
            If you have a question about records your school keeps, such as a child&apos;s attendance or a guardian&apos;s
            phone number, the school is usually the right place to start. We will help the school answer you.
          </p>
        </Section>

        <Section id="collect">
          <p>We collect only what attendance needs:</p>
          <ul>
            <li>
              <strong>Accounts</strong> for school staff and tertiary students: full name, email address, school ID (staff or
              student number), the schools you belong to and your role in each. Passwords are stored only as a secure,
              one-way hash; nobody at RollCol can read them.
            </li>
            <li>
              <strong>Student records</strong> that schools add: name, school ID, class (or programme and batch for tertiary
              students) and whether the record is active.
            </li>
            <li>
              <strong>Attendance</strong>: registers and check-in sessions, each mark (present, late or absent), when it was
              made and by whom, and any reward marks the teacher or lecturer set.
            </li>
            <li>
              <strong>Guardian contacts</strong> that schools add for basic and senior high school students: name, phone
              number, relationship to the student, and their SMS preferences.
            </li>
            <li>
              <strong>Parent app accounts</strong>, if a guardian chooses to use the RollCol app: their phone number (to
              sign in with a code sent by SMS), which guardian records and children their account is linked to, and the
              phone&apos;s notification token. A parent sees only the children on their own guardian record, after typing
              one of the child&apos;s names, and only the messages the school sent to their number.
            </li>
            <li>
              <strong>Records of changes</strong>, such as who added or removed a guardian, so schools can see what happened
              and guardians can be told.
            </li>
            <li>
              <strong>Technical information</strong> needed to run the service safely: sign-in times, failed sign-in
              attempts, and error reports from the app. We do not use advertising trackers.
            </li>
          </ul>
        </Section>

        <Section id="location">
          <p>Location and device information is used only for tertiary check-in in the mobile app:</p>
          <ul>
            <li>
              <strong>Location:</strong> when you check in to a session, the app reads your location once, at that moment,
              to confirm you are where the session is taking place. A lecturer&apos;s location is read once when they start a
              session that uses location. RollCol does not track your location at any other time, and never in the
              background.
            </li>
            <li>
              <strong>Device:</strong> your student account is linked to one phone, using an identifier the app creates, so
              attendance cannot be marked for you from someone else&apos;s phone. Changing phones is possible; your school
              sets out how.
            </li>
            <li>
              <strong>Face ID or fingerprint:</strong> when the app asks you to confirm a check-in this way, your phone does
              the check. RollCol only learns whether it succeeded, never your face or fingerprint.
            </li>
          </ul>
          <p>Basic and senior high school registers are marked by teachers and do not use location.</p>
        </Section>

        <Section id="use">
          <p>We use information only to provide RollCol to your school:</p>
          <ul>
            <li>to take registers and run check-in sessions, and to keep attendance records and totals;</li>
            <li>to send the notifications and SMS messages the school has set up;</li>
            <li>to let people sign in, recover their accounts and switch between their schools;</li>
            <li>to keep RollCol secure, prevent misuse and fix problems;</li>
            <li>to bill schools for the plans they choose.</li>
          </ul>
          <p>
            We do not sell personal information, use it for advertising, or use school records to build profiles of
            students or families.
          </p>
        </Section>

        <Section id="sms">
          <p>
            For basic and senior high schools, guardians can receive SMS messages about attendance (for example when a
            child is absent, late or has arrived), about changes to their contact details at the school, and announcements
            the school sends, such as a PTA (Parent-Teacher Association) meeting.
          </p>
          <ul>
            <li>A guardian is always told by SMS when they are added to or removed from a student.</li>
            <li>
              A guardian can ask the school to stop attendance messages for a child, or to stop announcements. They receive a
              final SMS confirming the change, and another if the messages are turned back on.
            </li>
            <li>RollCol sends these messages only for the school, and never sends marketing messages to guardians.</li>
          </ul>
        </Section>

        <Section id="children">
          <p>
            Students in basic and senior high schools are often under 18. They <strong>do not have RollCol accounts</strong>.
            Their records are added and managed by their school, which is responsible for having the right to use them,
            including any consent needed from parents or guardians. Only the school&apos;s admins and the child&apos;s
            teachers can see a child&apos;s records.
          </p>
          <p>Tertiary students create their own accounts in the app.</p>
        </Section>

        <Section id="sharing">
          <ul>
            <li>
              <strong>At your school:</strong> admins see the school&apos;s records. Teachers and lecturers see the classes,
              courses and students they teach. Tertiary students see their own attendance and marks. Staff cannot see other
              schools&apos; records, even if they work at more than one school.
            </li>
            <li>
              <strong>Service providers</strong> that run parts of RollCol for us, under contracts that limit them to doing
              so: hosting and database (Supabase and Vercel), SMS delivery, push notifications for the mobile app (through
              Apple and Google), email delivery for sign-in messages, and payment processing for schools (Paystack).
            </li>
            <li>
              <strong>Stediis:</strong> if your school also uses Stediis, another Teqxa product, and an admin connects the
              two, your school&apos;s courses and student list can be shared between them, and you can sign in to RollCol with
              your Stediis account.
            </li>
            <li>
              <strong>When the law requires it:</strong> we may disclose information if Ghanaian law or a valid legal request
              requires it, and we will tell the school unless we are not allowed to.
            </li>
          </ul>
        </Section>

        <Section id="storage">
          <p>
            RollCol&apos;s servers are run by our hosting providers, including in data centres outside Ghana such as in
            Europe. We protect information sent abroad in line with the Data Protection Act, 2012 (Act 843).
          </p>
          <ul>
            <li>We keep school records for as long as the school uses RollCol, or until the school deletes them.</li>
            <li>
              When a school closes its RollCol account, we delete its records within 90 days, except where the law requires
              us to keep something longer, such as billing records.
            </li>
            <li>When you delete your account, your account details are deleted straight away.</li>
            <li>Failed sign-in attempts are deleted after a day.</li>
          </ul>
        </Section>

        <Section id="security">
          <p>
            Information is encrypted while travelling between your device and RollCol. Access rules in the database
            itself decide who can see each record, not just the app, so one school can never read another school&apos;s
            records. Passwords are hashed, sign-in attempts are limited, and only a small number of RollCol staff can reach
            the systems, for support and maintenance.
          </p>
          <p>If we learn of a security problem that affects your information, we will tell your school and, where required, the authorities.</p>
        </Section>

        <Section id="rights">
          <p>Under the Data Protection Act, 2012 (Act 843), you can:</p>
          <ul>
            <li>ask what information RollCol holds about you, and for a copy;</li>
            <li>ask for wrong information to be corrected;</li>
            <li>ask for information to be deleted, or object to how it is used;</li>
            <li>as a guardian, ask the school to stop SMS messages.</li>
          </ul>
          <p>
            <strong>Deleting your account:</strong> you can delete your RollCol account at any time from Your account, on
            the website or in the app. This removes you from every school you belong to. Attendance records a school keeps
            about its students stay with that school.
          </p>
          <p>
            To use these rights, contact your school or email us at {mail}. If you are not happy with our answer, you can
            complain to the Data Protection Commission of Ghana.
          </p>
        </Section>

        <Section id="changes">
          <p>
            We will update this policy when RollCol changes. The date at the top shows the latest version. For important
            changes, we will tell schools before they take effect.
          </p>
        </Section>

        <Section id="contact">
          <p>Questions, requests or concerns about privacy: {mail}.</p>
        </Section>
      </article>
    </div>
  );
}
