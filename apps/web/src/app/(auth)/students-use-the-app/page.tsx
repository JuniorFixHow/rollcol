import type { Metadata } from "next";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = { title: "Finish joining in the app" };

export default function StudentsUseTheAppPage() {
  return (
    <div className="rounded-lg border border-line bg-surface p-6 shadow-sm">
      <h1 className="text-xl font-semibold">We could not finish joining your school</h1>
      <p className="mt-2 text-sm text-muted">
        Your email is confirmed, but RollCol could not add you to the school with the code and school ID you signed up
        with. Open the RollCol app on your phone and sign in with your email and password: it shows why, and lets you
        try again. Check-in works only in the app, because it uses your phone&apos;s location.
      </p>
      <p className="mt-4 text-sm text-muted">
        Registering a school as its admin?{" "}
        <a href="/onboarding" className="text-accent hover:underline">
          Register a school
        </a>
        . Your student account is not affected.
      </p>
      <div className="mt-5">
        <SignOutButton />
      </div>
    </div>
  );
}
