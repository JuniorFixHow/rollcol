"use client";

import Link from "next/link";
import { useState } from "react";
import { ActionForm, FormMessage, SubmitButton, TextField } from "@/components/form";
import { signInWithEmail, signInWithSchoolId } from "./actions";

export function SignInForms({ next }: { next: string | null }) {
  const [method, setMethod] = useState<"school" | "email">("school");

  return (
    <div className="rounded-lg border border-line bg-surface p-6 shadow-sm">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-muted">For school admins and teachers. Students use the RollCol mobile app.</p>

      <div role="tablist" aria-label="Sign-in method" className="mt-5 grid grid-cols-2 rounded-md bg-surface-muted p-1 text-sm">
        {(
          [
            ["school", "School ID"],
            ["email", "Email"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={method === value}
            onClick={() => setMethod(value)}
            className={`rounded px-3 py-1.5 font-medium ${method === value ? "bg-surface shadow-sm" : "text-muted hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {method === "school" ? (
          <ActionForm action={signInWithSchoolId} key="school">
            {next ? <input type="hidden" name="next" value={next} /> : null}
            <TextField
              name="schoolCode"
              label="School code"
              hint="Six letters or numbers. Your school admin can tell you."
              autoCapitalize="characters"
              autoComplete="organization"
            />
            <TextField name="schoolId" label="School ID" autoCapitalize="characters" autoComplete="username" />
            <TextField name="password" label="Password" type="password" autoComplete="current-password" />
            <FormMessage />
            <SubmitButton className="w-full" pendingLabel="Signing in...">
              Sign in
            </SubmitButton>
          </ActionForm>
        ) : (
          <ActionForm action={signInWithEmail} key="email">
            {next ? <input type="hidden" name="next" value={next} /> : null}
            <TextField name="email" label="Email" type="email" autoComplete="email" inputMode="email" />
            <TextField name="password" label="Password" type="password" autoComplete="current-password" />
            <FormMessage />
            <SubmitButton className="w-full" pendingLabel="Signing in...">
              Sign in
            </SubmitButton>
          </ActionForm>
        )}
      </div>

      <div className="mt-5 flex justify-between text-sm">
        <Link href="/forgot-password" className="text-accent hover:underline">
          Forgot password?
        </Link>
        <Link href="/sign-up" className="text-accent hover:underline">
          Register a school
        </Link>
      </div>
    </div>
  );
}
