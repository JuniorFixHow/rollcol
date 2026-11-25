"use client";

import { formatPhoneForDisplay } from "@rollcol/shared";
import { useActionState, useState } from "react";
import { FormStateContext, InlineAction, SubmitButton, TextField } from "@/components/form";
import { initialFormState } from "@/lib/forms";
import { checkPickupCode, releasePickup } from "./actions";

/** A teacher types the collector's code; RollCol shows the child and who may take them. */
export function CodeCheck() {
  const [attempt, setAttempt] = useState(0);
  return <Steps key={attempt} onAgain={() => setAttempt((n) => n + 1)} />;
}

function Steps({ onAgain }: { onAgain: () => void }) {
  const [state, action] = useActionState(checkPickupCode, initialFormState);
  const found = state.status === "success" ? state.values : undefined;

  if (found?.id && found.student) {
    const student = found.student;
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-success/40 bg-success-soft p-4">
          <p className="text-sm text-muted">Code is valid for today</p>
          <p className="mt-1 text-xl font-semibold">{found.student}</p>
          {found.className ? <p className="text-sm">{found.className}</p> : null}
          <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[9rem_1fr]">
            <dt className="text-muted">Collected by</dt>
            <dd className="font-medium">
              {found.collector}
              {found.collectorPhone ? ` · ${formatPhoneForDisplay(found.collectorPhone)}` : ""}
            </dd>
            {found.parent ? (
              <>
                <dt className="text-muted">Code made by</dt>
                <dd>{found.parent} (parent, in RollCol)</dd>
              </>
            ) : null}
          </dl>
          <p className="mt-3 text-sm">Ask the collector for their name. Release the child only if it matches.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <InlineAction
            action={releasePickup}
            hidden={{ id: found.id }}
            label={`Release ${student.split(/\s+/)[0] ?? "the child"}`}
            variant="primary"
            confirm={`Release ${student} to ${found.collector}? The code is then used, and the parent is told.`}
          />
          <button type="button" className="text-sm font-medium text-accent hover:underline" onClick={onAgain}>
            Check another code
          </button>
        </div>
      </div>
    );
  }

  return (
    <FormStateContext value={state}>
      <form action={action} className="flex flex-wrap items-end gap-3" noValidate>
        <div className="w-48">
          <TextField name="code" label="Pickup code" inputMode="numeric" autoComplete="off" placeholder="123456" />
        </div>
        <SubmitButton pendingLabel="Checking...">Check</SubmitButton>
      </form>
      {state.status === "error" && state.message ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {state.message}
        </p>
      ) : null}
    </FormStateContext>
  );
}
