"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { buttonClass, inputClass } from "@/components/ui";
import { type FormState, initialFormState } from "@/lib/forms";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/**
 * A button that asks for a reason in RollCol's own dialog, then runs the
 * action with the reason (field "reason") and any hidden values.
 */
export function ReasonAction({
  action,
  label,
  title,
  message,
  confirmLabel,
  placeholder,
  hidden,
  variant = "secondary",
}: {
  action: Action;
  label: string;
  title: string;
  message?: string;
  confirmLabel?: string;
  placeholder?: string;
  hidden?: Record<string, string>;
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, initialFormState);
  const [handled, setHandled] = useState<FormState | null>(null);

  // Close once the action succeeds. Each result object is handled once.
  if (open && state.status === "success" && handled !== state) {
    setHandled(state);
    setOpen(false);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClass(variant, "sm")}>
        {label}
      </button>
      {open
        ? createPortal(
            <ReasonDialog
              title={title}
              message={message}
              confirmLabel={confirmLabel ?? label}
              placeholder={placeholder}
              hidden={hidden}
              danger={variant === "danger"}
              formAction={formAction}
              error={state.status === "error" && handled !== state ? (state.fieldErrors?.reason ?? state.message) : undefined}
              onClose={() => {
                setHandled(state);
                setOpen(false);
              }}
            />,
            document.body,
          )
        : null}
    </>
  );
}

function ReasonDialog({
  title,
  message,
  confirmLabel,
  placeholder,
  hidden,
  danger,
  formAction,
  error,
  onClose,
}: {
  title: string;
  message?: string;
  confirmLabel: string;
  placeholder?: string;
  hidden?: Record<string, string>;
  danger: boolean;
  formAction: (formData: FormData) => void;
  error?: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-line bg-surface p-0 text-left text-foreground shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-[2px]"
    >
      <form action={formAction} noValidate className="p-6">
        {hidden
          ? Object.entries(hidden).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)
          : null}
        <h2 id={`${id}-title`} className="text-lg font-semibold">
          {title}
        </h2>
        {message ? <p className="mt-2 text-sm leading-6 text-muted">{message}</p> : null}
        <label htmlFor={`${id}-reason`} className="mt-4 mb-1.5 block text-sm font-medium">
          Reason
        </label>
        <input
          id={`${id}-reason`}
          name="reason"
          autoFocus
          autoComplete="off"
          maxLength={300}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-muted">Kept in the session&rsquo;s history.</p>
        {error ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={buttonClass("secondary")}>
            Cancel
          </button>
          <ConfirmButton label={confirmLabel} danger={danger} />
        </div>
      </form>
    </dialog>
  );
}

function ConfirmButton({ label, danger }: { label: string; danger: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass(danger ? "danger" : "primary")}>
      {pending ? "Saving..." : label}
    </button>
  );
}
