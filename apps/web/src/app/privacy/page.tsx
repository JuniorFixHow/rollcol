import { SUPPORT_EMAIL } from "@rollcol/shared";
import type { Metadata } from "next";
import { Brand } from "@/components/brand";

export const metadata: Metadata = { title: "Privacy policy" };

// DRAFT for review before launch (build plan step 9). The mobile app links here.
export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <Brand />
      <article className="mt-8 space-y-5 text-sm leading-6 [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground">
        <h1 className="text-2xl font-semibold tracking-tight">Privacy policy</h1>
        <p className="text-muted">Draft. Last updated 19 November 2026.</p>

        <p>
          RollCol is an attendance service made by Teqxa for schools in Ghana. This policy explains what we collect, why,
          and the choices you have. Schools decide how they use RollCol for their students; we process school records on
          their behalf.
        </p>

        <h2>What we collect</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Staff and student accounts: name, school ID, email address and password (stored only as a secure hash).</li>
          <li>Student records added by schools: name, school ID, class or programme, and attendance.</li>
          <li>Guardian contacts added by schools: name, phone number and relationship to the student.</li>
          <li>
            For tertiary check-in in the mobile app: your location at the moment you check in, and an identifier for your
            device so attendance cannot be marked from someone else&apos;s phone. We do not track location at any other
            time.
          </li>
        </ul>

        <h2>How we use it</h2>
        <p>
          Only to provide attendance for your school: registers and check-in, records and reports, and SMS messages to
          guardians that the school has set up. We do not sell personal information or use it for advertising.
        </p>

        <h2>Who can see it</h2>
        <p>
          Admins at your school, and teachers or lecturers for their own classes and courses. Guardians receive SMS
          messages only; they do not have accounts. Our SMS and hosting providers process data only to deliver the
          service.
        </p>

        <h2>Deleting your account</h2>
        <p>
          You can delete your RollCol account at any time from the app or the website. This deletes your account and the
          data tied to it. Records a school keeps about attendance may stay with that school.
        </p>

        <h2>Contact</h2>
        <p>
          Questions or requests: <a className="text-accent hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
      </article>
    </div>
  );
}
