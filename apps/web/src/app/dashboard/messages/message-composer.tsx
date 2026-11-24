"use client";

import { MAX_MESSAGE_SEGMENTS, messageCost } from "@rollcol/shared";
import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useConfirm } from "@/components/confirm-dialog";
import { useFreshState } from "@/components/form";
import { buttonClass, inputClass } from "@/components/ui";
import { type FormState, initialFormState } from "@/lib/forms";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export interface ClassAudience {
  id: string;
  name: string;
  /** Guardians in this class who accept broadcasts. One guardian can be in several classes. */
  guardianIds: string[];
}

/**
 * Write a message, see what it costs, confirm, send. Either to a fixed group
 * (one student's guardians) or, for broadcasts, to all guardians or chosen classes.
 */
export function MessageComposer({
  action,
  schoolName,
  balance,
  recipients,
  classes,
  allGuardians,
  inApp,
  inAppRecipients,
  hidden,
  placeholder,
  sendLabel = "Send",
  quietNote = null,
}: {
  action: Action;
  /** Added to the start of every SMS, so it counts towards the length. */
  schoolName: string;
  balance: number | null;
  /** Fixed recipients (custom messages). Leave out for broadcasts with classes. */
  recipients?: number;
  classes?: ClassAudience[];
  /** Everyone a broadcast to "All guardians" reaches, including children without a class. */
  allGuardians?: number;
  /** Guardians who get messages in the RollCol app (no credits). */
  inApp?: string[];
  /** For fixed recipients: how many of them get it in the app. */
  inAppRecipients?: number;
  hidden?: Record<string, string>;
  placeholder?: string;
  sendLabel?: string;
  /** The school's quiet hours in words, or null when it has none. */
  quietNote?: string | null;
}) {
  const [rawState, formAction] = useActionState(action, initialFormState);
  const state = useFreshState(rawState);
  const [ask, dialog] = useConfirm();
  const confirmed = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const id = useId();
  const [body, setBody] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);

  useEffect(() => {
    if (rawState.status === "success") {
      formRef.current?.reset();
      // Clear the composer after a send; the form state change is the external event.
      queueMicrotask(() => {
        setBody("");
        setChosen([]);
      });
    }
  }, [rawState]);

  const reach = useMemo(() => {
    if (recipients !== undefined) return recipients;
    if (chosen.length === 0 && allGuardians !== undefined) return allGuardians;
    const groups = chosen.length === 0 ? (classes ?? []) : (classes ?? []).filter((c) => chosen.includes(c.id));
    return new Set(groups.flatMap((c) => c.guardianIds)).size;
  }, [recipients, classes, allGuardians, chosen]);

  // Guardians who get it in the RollCol app use no credits (the server counts exactly).
  const appReach = useMemo(() => {
    if (recipients !== undefined) return Math.min(inAppRecipients ?? 0, recipients);
    const app = new Set(inApp ?? []);
    const groups = chosen.length === 0 ? (classes ?? []) : (classes ?? []).filter((c) => chosen.includes(c.id));
    return Math.min(new Set(groups.flatMap((c) => c.guardianIds).filter((g) => app.has(g))).size, reach);
  }, [recipients, inAppRecipients, inApp, classes, chosen, reach]);

  const cost = messageCost(schoolName, body);
  const credits = cost.segments * (reach - appReach);
  const tooLong = cost.segments > MAX_MESSAGE_SEGMENTS;
  const short = body.trim().length < 5;
  const notEnough = balance !== null && credits > balance;
  const error = state.status === "error" ? state.message : undefined;

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        if (confirmed.current) {
          confirmed.current = false;
          return;
        }
        event.preventDefault();
        const form = event.currentTarget;
        const who = reach === 1 ? "1 guardian" : `${reach} guardians`;
        void ask({
          title: `Send this to ${who}?`,
          message: `It uses ${credits} SMS ${credits === 1 ? "credit" : "credits"}.${quietNote ? ` ${quietNote}` : ""}`,
          confirmLabel: sendLabel,
        }).then((ok) => {
          if (!ok) return;
          confirmed.current = true;
          form.requestSubmit();
        });
      }}
    >
      {hidden
        ? Object.entries(hidden).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)
        : null}

      {classes && (classes.length > 0 || allGuardians !== undefined) ? (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Who gets it</legend>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setChosen([])}
              className={`rounded-full border px-3 py-1 text-sm ${
                chosen.length === 0 ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-foreground"
              }`}
            >
              All guardians
            </button>
            {classes.map((c) => {
              const on = chosen.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setChosen((current) => (on ? current.filter((x) => x !== c.id) : [...current, c.id]))}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    on ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-foreground"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
          {chosen.map((classId) => (
            <input key={classId} type="hidden" name="classIds" value={classId} />
          ))}
        </fieldset>
      ) : null}

      <div>
        <label htmlFor={`${id}-body`} className="mb-1.5 block text-sm font-medium">
          Message
        </label>
        <textarea
          id={`${id}-body`}
          name="body"
          rows={4}
          maxLength={450}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          className={`${inputClass} min-h-28 resize-y`}
        />
        <p className="mt-1 text-xs text-muted">
          Starts with &ldquo;{schoolName}:&rdquo;. {cost.characters} characters, {cost.segments}{" "}
          {cost.segments === 1 ? "SMS" : "SMS each"} per guardian. One SMS holds 160 characters.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface-muted px-3 py-2 text-sm">
        <span>
          {reach === 1 ? "1 guardian" : `${reach} guardians`}
          {appReach > 0 ? ` (${appReach} in the app)` : ""} · {credits} {credits === 1 ? "credit" : "credits"}
        </span>
        {balance !== null ? (
          <span className={notEnough ? "text-danger" : "text-muted"}>{balance} credits left</span>
        ) : null}
      </div>

      {tooLong ? <p className="text-sm text-danger">Keep the message to {MAX_MESSAGE_SEGMENTS} SMS.</p> : null}
      {notEnough ? <p className="text-sm text-danger">The school does not have enough SMS credits for this.</p> : null}
      {state.status !== "idle" && state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`rounded-md border px-3 py-2 text-sm ${
            state.status === "error" ? "border-danger/30 bg-danger-soft text-danger" : "border-success/30 bg-success-soft text-success"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <SendButton disabled={short || tooLong || notEnough || reach === 0} label={sendLabel} />
      {dialog}
    </form>
  );
}

function SendButton({ disabled, label }: { disabled: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className={buttonClass("primary")}>
      {pending ? "Sending..." : label}
    </button>
  );
}
