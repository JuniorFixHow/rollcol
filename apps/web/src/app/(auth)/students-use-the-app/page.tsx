import type { Metadata } from "next";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = { title: "Use the RollCol app" };

export default function StudentsUseTheAppPage() {
  return (
    <div className="rounded-lg border border-line bg-surface p-6 shadow-sm">
      <h1 className="text-xl font-semibold">Students use the RollCol app</h1>
      <p className="mt-2 text-sm text-muted">
        Open the RollCol app on your phone and sign in with your school code, school ID and password. If you just
        confirmed your email, you can sign in there now. Check-in works only in the app, because it uses your
        phone&apos;s location.
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
