"use client";

import { useActionState, useState } from "react";
import { FormStateContext, SubmitButton, TextField } from "@/components/form";
import { type FormState, initialFormState } from "@/lib/forms";
import { sendParentCode, verifyParentCode } from "./actions";

/**
 * Parents sign in with the phone number their child's school has and a
 * six-digit code sent to it by SMS. No password.
 */
export function ParentSignIn() {
  // "Use another number" starts the steps again from scratch.
  const [attempt, setAttempt] = useState(0);
  return <ParentSteps key={attempt} onRestart={() => setAttempt((n) => n + 1)} />;
}

function ParentSteps({ onRestart }: { onRestart: () => void }) {
  const [sent, sendAction] = useActionState(sendParentCode, initialFormState);
  const [verified, verifyAction] = useActionState(verifyParentCode, initialFormState);
  const phone = sent.status === "success" ? sent.values?.phone : undefined;

  if (phone === undefined) {
    return (
      <FormStateContext value={sent}>
        <form action={sendAction} className="space-y-4" noValidate>
          <TextField
            name="phone"
            label="Phone number"
            hint="The number your child's school has for you."
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="024 123 4567"
          />
          <Message state={sent} />
          <SubmitButton className="w-full" pendingLabel="Sending...">
            Send code
          </SubmitButton>
          <p className="text-sm text-muted">We send a six-digit code to this number by SMS. You do not need a password.</p>
        </form>
      </FormStateContext>
    );
  }

  return (
    <div className="space-y-4">
      <FormStateContext value={verified}>
        <form action={verifyAction} className="space-y-4" noValidate>
          <p className="text-sm">{sent.message}</p>
          <input type="hidden" name="phone" value={phone} />
          <TextField name="code" label="Code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" />
          <Message state={verified} />
          <SubmitButton className="w-full" pendingLabel="Signing in...">
            Sign in
          </SubmitButton>
        </form>
      </FormStateContext>
      <form action={sendAction}>
        <input type="hidden" name="phone" value={phone} />
        <SubmitButton variant="secondary" className="w-full" pendingLabel="Sending...">
          Send a new code
        </SubmitButton>
      </form>
      <button type="button" className="text-sm font-medium text-accent hover:underline" onClick={onRestart}>
        Use another number
      </button>
    </div>
  );
}

function Message({ state }: { state: FormState }) {
  if (state.status !== "error" || !state.message) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {state.message}
    </p>
  );
}
