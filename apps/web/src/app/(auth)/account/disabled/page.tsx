import type { Metadata } from "next";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = { title: "Account turned off" };

export default function DisabledPage() {
  return (
    <div className="rounded-lg border border-line bg-surface p-6 shadow-sm">
      <h1 className="text-xl font-semibold">Your account is turned off</h1>
      <p className="mt-2 text-sm text-muted">
        An admin at your school has turned off your access to RollCol. If you think this is a mistake, speak to your school
        admin.
      </p>
      <div className="mt-5">
        <SignOutButton />
      </div>
    </div>
  );
}
