"use server";

import { describeDatabaseError } from "@rollcol/shared";
import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { type FormState, failed, formBoolean, formValues, succeeded } from "@/lib/forms";

export interface DayInput {
  weekday: number;
  opens: string;
  closes: string;
  breaks: { label: string; start: string; end: string }[];
}

/** The usual week, for the school (classId null) or one class. Empty days for a class: back to the school's times. */
export async function saveSchoolDay(classId: string | null, days: DayInput[]): Promise<{ error: string | null }> {
  const { supabase, member } = await requireAdmin();
  const { error } = await supabase.rpc("set_school_day", {
    p_school_id: member.school.id,
    p_class_id: classId,
    p_days: days.map((d) => ({ weekday: d.weekday, opens: d.opens, closes: d.closes, breaks: d.breaks })),
  });
  if (error) return { error: describeDatabaseError(error) };
  refresh();
  return { error: null };
}

/** A one-off change: closed, or different times, for the whole school or some classes. */
export async function addDayChange(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireAdmin();
  const values = formValues(formData);
  const classIds = Object.keys(values)
    .filter((key) => key.startsWith("class:") && values[key] === "on")
    .map((key) => key.slice("class:".length));
  if (!values.day) return failed("Choose the day.", values);
  const kind = values.kind;
  if (kind !== "closed" && kind !== "times") return failed("Choose what changes.", values);
  if (values.who === "some" && classIds.length === 0) return failed("Tick the classes, or choose the whole school.", values);
  if (kind === "times" && !values.opens && !values.closes) return failed("Give the new arrival time, closing time, or both.", values);
  const { error } = await supabase.rpc("add_school_day_change", {
    p_school_id: member.school.id,
    p_class_ids: values.who === "some" ? classIds : null,
    p_day: values.day,
    p_closed: kind === "closed",
    p_opens: kind === "times" && values.opens ? values.opens : null,
    p_closes: kind === "times" && values.closes ? values.closes : null,
    p_note: values.note || null,
    p_notify: formBoolean(formData, "notify"),
  });
  if (error) return failed(describeDatabaseError(error), values);
  refresh();
  return succeeded(formBoolean(formData, "notify") ? "Saved, and the parents have been told." : "Saved.");
}

export async function cancelDayChange(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("cancel_school_day_change", { p_id: String(formData.get("id") ?? "") });
  if (error) return failed(describeDatabaseError(error));
  refresh();
  return succeeded("Cancelled.");
}
