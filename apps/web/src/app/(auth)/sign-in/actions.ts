"use server";

import { emailSignInSchema, schoolIdSignInSchema, toMember } from "@rollcol/shared";
import { redirect } from "next/navigation";
import { homeFor } from "@/lib/auth";
import { type FormState, failed, formValues, invalid } from "@/lib/forms";
import { safeNextPath } from "@/lib/redirects";
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

  return finishSignIn(supabase, result.email, parsed.data.password, values);
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

  const { data } = await supabase.rpc("current_member");
  const destination = safeNextPath(values.next) ?? homeFor(toMember(data?.[0]));
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
