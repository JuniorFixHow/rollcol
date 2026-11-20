"use client";

import { createContext, type ReactNode, use, useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useConfirm } from "@/components/confirm-dialog";
import { buttonClass, inputClass } from "@/components/ui";
import { type FormState, initialFormState } from "@/lib/forms";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

const FormStateContext = createContext<FormState>(initialFormState);

/**
 * A form wired to a Server Action through useActionState. Fields inside read
 * their error and previous value from the returned state.
 */
export function ActionForm({
  action,
  children,
  className = "space-y-4",
  resetOnSuccess = false,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state.status === "success") formRef.current?.reset();
  }, [resetOnSuccess, state]);

  return (
    <FormStateContext value={state}>
      <form ref={formRef} action={formAction} className={className} noValidate>
        {children}
      </form>
    </FormStateContext>
  );
}

export function FormMessage() {
  const state = use(FormStateContext);
  if (state.status === "idle" || !state.message) return null;
  const tone =
    state.status === "error"
      ? "border-danger/30 bg-danger-soft text-danger"
      : "border-success/30 bg-success-soft text-success";
  return (
    <p role={state.status === "error" ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-sm ${tone}`}>
      {state.message}
    </p>
  );
}

function useField(name: string, defaultValue?: string) {
  const state = use(FormStateContext);
  const error = state.fieldErrors?.[name];
  const value = state.values?.[name] ?? defaultValue;
  return { error, value };
}

/**
 * Labels sit on one line above the input and hints go below it, so inputs side
 * by side in a row always line up.
 */
function Label({ htmlFor, label }: { htmlFor: string; label: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block truncate text-sm font-medium">
      {label}
    </label>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {open ? null : <path d="M4 4l16 16" />}
    </svg>
  );
}

function Hint({ id, hint }: { id: string; hint?: string }) {
  if (!hint) return null;
  return (
    <p id={id} className="mt-1 text-xs text-muted">
      {hint}
    </p>
  );
}

/**
 * Holds a submit button in a row of fields, lined up with the inputs rather
 * than with their labels. Use in grids with items-start.
 */
export function FieldButton({ children, always = false }: { children: ReactNode; always?: boolean }) {
  return <div className={always ? "pt-[1.625rem]" : "sm:pt-[1.625rem]"}>{children}</div>;
}

function describedBy(id: string, hint?: string, error?: string): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter((value) => value !== null);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={id} className="mt-1 text-xs text-danger">
      {error}
    </p>
  );
}

export function TextField({
  name,
  label,
  hint,
  type = "text",
  defaultValue,
  required,
  autoComplete,
  placeholder,
  inputMode,
  autoCapitalize,
  min,
  max,
  step,
}: {
  name: string;
  label: string;
  hint?: string;
  type?: "text" | "email" | "password" | "tel" | "date" | "time" | "datetime-local" | "number";
  defaultValue?: string;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "email";
  autoCapitalize?: "none" | "characters" | "words";
  min?: string;
  max?: string;
  step?: string;
}) {
  const id = useId();
  const { error, value } = useField(name, defaultValue);
  // Password fields get an eye button to show or hide what was typed.
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";

  return (
    <div>
      <Label htmlFor={id} label={label} />
      <div className="relative">
        <input
          // Remount with the returned value after an error so the input shows it.
          key={value ?? ""}
          id={id}
          name={name}
          type={isPassword && revealed ? "text" : type}
          defaultValue={isPassword ? undefined : value}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          inputMode={inputMode}
          autoCapitalize={isPassword ? "none" : autoCapitalize}
          spellCheck={isPassword ? false : undefined}
          min={min}
          max={max}
          step={step}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={isPassword ? `${inputClass} pr-11` : inputClass}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setRevealed((shown) => !shown)}
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
          >
            <EyeIcon open={!revealed} />
          </button>
        ) : null}
      </div>
      <Hint id={`${id}-hint`} hint={hint} />
      <FieldError id={`${id}-error`} error={error} />
    </div>
  );
}

export function SelectField({
  name,
  label,
  hint,
  options,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  hint?: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  placeholder?: string;
}) {
  const id = useId();
  const { error, value } = useField(name, defaultValue);
  return (
    <div>
      <Label htmlFor={id} label={label} />
      <select
        key={value ?? ""}
        id={id}
        name={name}
        defaultValue={value ?? ""}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={inputClass}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Hint id={`${id}-hint`} hint={hint} />
      <FieldError id={`${id}-error`} error={error} />
    </div>
  );
}

export function RadioGroupField({
  name,
  label,
  hint,
  options,
  defaultValue,
}: {
  name: string;
  label: string;
  hint?: string;
  options: { value: string; label: string; description?: string }[];
  defaultValue?: string;
}) {
  const { error, value } = useField(name, defaultValue);
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-medium">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2" key={value ?? ""}>
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer gap-3 rounded-md border border-line bg-surface p-3 text-sm has-checked:border-accent has-checked:bg-accent-soft"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={value === option.value}
              className="mt-0.5 accent-accent"
            />
            <span>
              <span className="block font-medium">{option.label}</span>
              {option.description ? <span className="block text-xs text-muted">{option.description}</span> : null}
            </span>
          </label>
        ))}
      </div>
      {hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </fieldset>
  );
}

export function CheckboxField({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer gap-3 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-4 accent-accent" />
      <span>
        <span className="block font-medium">{label}</span>
        {description ? <span className="block text-xs text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  className = "",
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: Parameters<typeof buttonClass>[0];
  size?: "md" | "sm";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${buttonClass(variant, size)} ${className}`}>
      {pending ? (pendingLabel ?? "Saving...") : children}
    </button>
  );
}

/**
 * A one-button form for row actions (approve, remove and so on), with its
 * error shown beside the button.
 */
export function InlineAction({
  action,
  label,
  pendingLabel,
  variant = "secondary",
  confirm,
  hidden,
}: {
  action: Action;
  label: string;
  pendingLabel?: string;
  variant?: Parameters<typeof buttonClass>[0];
  confirm?: string;
  hidden?: Record<string, string>;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const [ask, dialog] = useConfirm();
  const confirmed = useRef(false);

  return (
    <form
      action={formAction}
      className="inline-flex flex-col items-end gap-1"
      onSubmit={(event) => {
        if (!confirm || confirmed.current) {
          confirmed.current = false;
          return;
        }
        // Ask first in RollCol's own dialog, then submit again once confirmed.
        event.preventDefault();
        const form = event.currentTarget;
        const { title, message } = splitQuestion(confirm);
        void ask({
          title,
          message,
          confirmLabel: label,
          tone: variant === "danger" ? "danger" : "primary",
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
      <SubmitButton variant={variant} size="sm" pendingLabel={pendingLabel}>
        {label}
      </SubmitButton>
      {state.status === "error" && state.message ? (
        <span role="alert" className="max-w-60 text-right text-xs text-danger">
          {state.message}
        </span>
      ) : null}
      {dialog}
    </form>
  );
}

/** "Remove Ama? Their records stay." becomes a title and a message. */
function splitQuestion(text: string): { title: string; message?: string } {
  const end = text.indexOf("? ");
  if (end === -1) return { title: text };
  return { title: text.slice(0, end + 1), message: text.slice(end + 2) };
}
