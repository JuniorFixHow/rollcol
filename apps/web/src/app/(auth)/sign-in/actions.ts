"use server";

import {
  chooseMember,
  emailSignInSchema,
  formatPhoneForDisplay,
  normalisePhone,
  schoolIdSignInSchema,
  toMemberships,
} from "@rollcol/shared";
import { redirect } from "next/navigation";
import { homeFor } from "@/lib/auth";
import { type FormState, failed, formValues, invalid } from "@/lib/forms";
import { safeNextPath } from "@/lib/redirects";
import { rememberSchool } from "@/lib/school-actions";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const WRONG_DETAILS = "Those sign-in details are not right. Check them and try again.";

export async function signInWithSchoolId(_: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = schoolIdSignInSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sign_in_email", {
    p_school_code: parsed.data.schoolCode,
    p_school_number: parsed.data.schoolId,
    p_password: parsed.data.password,
  });
  if (error) return failed(error, values);

  const result = lookupResult(data);
  if (result.status === "locked") {
    return failed("Too many attempts with this school ID. Wait 15 minutes, then try again.", values);
  }
  if (result.status !== "ok") return failed(WRONG_DETAILS, values);

  return finishSignIn(supabase, result.email, parsed.data.password, values, parsed.data.schoolCode);
}

export async function signInWithEmail(_: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = emailSignInSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  const supabase = await createClient();
  return finishSignIn(supabase, parsed.data.email, parsed.data.password, values);
}

async function finishSignIn(
  supabase: Supabase,
  email: string,
  password: string,
  values: Record<string, string>,
  schoolCode?: string,
): Promise<FormState> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return failed("Confirm your email address first. Use the link we sent when you signed up.", values);
    }
    if (error.code === "over_request_rate_limit" || error.status === 429) {
      return failed("Too many attempts. Wait a few minutes, then try again.", values);
    }
    return failed(WRONG_DETAILS, values);
  }

  const [{ data: rows }, { data: isAdmin }] = await Promise.all([
    supabase.rpc("my_memberships"),
    supabase.rpc("is_platform_admin"),
  ]);
  const memberships = toMemberships(rows, isAdmin === true);
  // Signing in with a school code opens that school's dashboard.
  const signedInSchool = schoolCode ? memberships.find((m) => m.school.code === schoolCode) : undefined;
  if (signedInSchool) await rememberSchool(signedInSchool.school.id);

  const member = chooseMember(memberships, isAdmin === true, {
    preferredSchoolId: signedInSchool?.school.id ?? null,
    preferKind: "staff",
  });
  const destination = safeNextPath(values.next) ?? homeFor(member);
  redirect(destination);
}

/** sign_in_email returns jsonb; check its shape rather than trusting it. */
function lookupResult(value: unknown): { status: "ok"; email: string } | { status: "locked" | "invalid" } {
  if (typeof value !== "object" || value === null) return { status: "invalid" };
  const status = "status" in value ? value.status : undefined;
  const email = "email" in value ? value.email : undefined;
  if (status === "ok" && typeof email === "string") return { status: "ok", email };
  if (status === "locked") return { status: "locked" };
  return { status: "invalid" };
}

/** Turns Supabase Auth's answer about a sign-in code into words a parent understands. */
function describeCodeError(error: { message: string; status?: number; code?: string }): string {
  if (error.status === 429 || error.code === "over_sms_send_rate_limit") {
    return "Too many codes were sent to this number. Wait a few minutes, then try again.";
  }
  if (/guardian list/i.test(error.message)) {
    return "This number is not on your child's school records in RollCol. Use the number the school has, or ask the school to add it.";
  }
  if (/test mode/i.test(error.message)) return "RollCol cannot send sign-in codes yet (SMS is in test mode).";
  return "RollCol could not send the code. Please try again in a moment.";
}

/** Parents, step 1: a six-digit code by SMS to the number their child's school has. */
export async function sendParentCode(_: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const phone = normalisePhone(values.phone ?? "");
  if (!phone) return failed("Enter a phone number, for example 024 123 4567.", values);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) return failed(describeCodeError(error), values);
  return { status: "success", message: `We sent a code to ${formatPhoneForDisplay(phone)}.`, values: { phone } };
}

/** Parents, step 2: the code from the SMS signs them in. */
export async function verifyParentCode(_: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const phone = normalisePhone(values.phone ?? "");
  const token = (values.code ?? "").replace(/\D/g, "");
  if (!phone) return failed("Start again with your phone number.", values);
  if (token.length !== 6) return failed("Enter the six-digit code from the SMS.", { phone });
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
  if (error) {
    return failed(
      error.status === 429
        ? "Too many attempts. Wait a few minutes, then try again."
        : "That code is not right, or it has expired. Check it, or send a new code.",
      { phone },
    );
  }
  redirect("/parent");
}
