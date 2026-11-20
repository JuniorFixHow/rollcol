import { describeDatabaseError } from "@rollcol/shared";
import type { ZodError } from "@rollcol/shared";

/** What every form action returns to useActionState. */
export interface FormState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
  /** Submitted values, so the form can show them again after an error. */
  values?: Partial<Record<string, string>>;
}

export const initialFormState: FormState = { status: "idle" };

/** String values of a form, without Next.js's internal $ACTION fields. */
export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("$ACTION") && typeof value === "string") values[key] = value;
  }
  return values;
}

/** Checkbox inputs send "on" when ticked and nothing when not. */
export function formBoolean(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

export function invalid(error: ZodError, values?: Record<string, string>): FormState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".");
    if (key && fieldErrors[key] === undefined) fieldErrors[key] = issue.message;
  }
  const withoutPasswords = values ? stripSecrets(values) : undefined;
  const formMessage = error.issues.find((issue) => issue.path.length === 0)?.message;
  return {
    status: "error",
    message: formMessage ?? "Check the highlighted fields.",
    fieldErrors,
    values: withoutPasswords,
  };
}

export function failed(error: { code?: string; message: string } | string, values?: Record<string, string>): FormState {
  const message = typeof error === "string" ? error : describeDatabaseError(error);
  return { status: "error", message, values: values ? stripSecrets(values) : undefined };
}

export function succeeded(message: string): FormState {
  return { status: "success", message };
}

function stripSecrets(values: Record<string, string>): Record<string, string> {
  const copy = { ...values };
  delete copy.password;
  delete copy.confirmPassword;
  return copy;
}
