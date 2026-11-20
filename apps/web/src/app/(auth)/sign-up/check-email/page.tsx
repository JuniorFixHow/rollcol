import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  return (
    <div className="rounded-lg border border-line bg-surface p-6 shadow-sm">
      <h1 className="text-xl font-semibold">Check your email</h1>
      <p className="mt-2 text-sm text-muted">
        We sent you a link to confirm your email address. Open it on this device to finish setting up your school.
      </p>
      <p className="mt-4 text-sm text-muted">
        No email after a few minutes? Check your spam folder, or{" "}
        <Link href="/sign-up" className="text-accent hover:underline">
          try again
        </Link>
        .
      </p>
    </div>
  );
}
