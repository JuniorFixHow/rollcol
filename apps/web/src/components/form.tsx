"use client";

import { createContext, type ReactNode, use, useActionState, useEffect, useId, useRef } from "react";
import { useFormStatus } from "react-dom";
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
  const tone = state.status === "error" ? "border-danger/30 bg-danger-soft text-danger" : "border-success/30 bg-success-soft text-success";
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

function Label({ htmlFor, label, hint }: { htmlFor: string; label: string; hint?: string }) {
  return (
    <div className="mb-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
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
}: {
  name: string;
  label: string;
  hint?: string;
  type?: "text" | "email" | "password" | "tel" | "date" | "number";
  defaultValue?: string;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
  autoCapitalize?: "none" | "characters" | "words";
}) {
  const id = useId();
  const { error, value } = useField(name, defaultValue);
  return (
    <div>
      <Label htmlFor={id} label={label} hint={hint} />
      <input
        // Remount with the returned value after an error so the input shows it.
        key={value ?? ""}
        id={id}
        name={name}
        type={type}
        defaultValue={type === "password" ? undefined : value}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        inputMode={inputMode}
        autoCapitalize={autoCapitalize}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClass}
      />
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
      <Label htmlFor={id} label={label} hint={hint} />
      <select
        key={value ?? ""}
        id={id}
        name={name}
        defaultValue={value ?? ""}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClass}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldError id={`${id}-error`} error={error} />
    </div>
  );
}

export function RadioGroupField({
  name,
  label,
  options,
  defaultValue,
}: {
  name: string;
  label: string;
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
            <input type="radio" name={name} value={option.value} defaultChecked={value === option.value} className="mt-0.5 accent-accent" />
            <span>
              <span className="block font-medium">{option.label}</span>
              {option.description ? <span className="block text-xs text-muted">{option.description}</span> : null}
            </span>
          </label>
        ))}
      </div>
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
  return (
    <form
      action={formAction}
      className="inline-flex flex-col items-end gap-1"
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
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
    </form>
  );
}
