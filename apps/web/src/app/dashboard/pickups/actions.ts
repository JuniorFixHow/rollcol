"use server";

import { describeDatabaseError } from "@rollcol/shared";
import { refresh } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { type FormState, failed, formValues, succeeded } from "@/lib/forms";

/** Looks up a code typed by a teacher; the result rides in the form state's values. */
export async function checkPickupCode(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireStaff();
  const code = (formValues(formData).code ?? "").replace(/\D/g, "");
  if (code.length !== 6) return failed("Type the six digits of the code.", { code });
  const { data, error } = await supabase.rpc("check_pickup_code", { p_school_id: member.school.id, p_code: code });
  if (error) return failed(describeDatabaseError(error), { code });
  const found = data[0];
  if (!found) {
    return failed("No code for today matches. Check the digits with the collector, or call the parent.", { code });
  }
  return {
    status: "success",
    message: "found",
    values: {
      id: found.id,
      student: found.student_name,
      className: found.class_name ?? "",
      collector: found.collector_name,
      collectorPhone: found.collector_phone ?? "",
      parent: found.parent_name ?? "",
    },
  };
}

export async function releasePickup(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc("release_pickup", { p_id: String(formData.get("id") ?? "") });
  if (error) return failed(describeDatabaseError(error));
  refresh();
  return succeeded("Released. The parent has been told.");
}
