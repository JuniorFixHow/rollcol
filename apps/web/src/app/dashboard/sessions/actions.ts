"use server";

import { sessionReasonSchema, startSessionSchema, venueSchema } from "@rollcol/shared";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { type FormState, failed, formBoolean, formValues, invalid, succeeded } from "@/lib/forms";

export async function startSession(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireStaff();
  if (member.school.type !== "tertiary") return failed("Sessions are for tertiary schools.");
  const values = formValues(formData);
  const parsed = startSessionSchema.safeParse({
    courseRunId: values.courseRunId,
    minutes: values.minutes,
    when: values.when === "later" ? "later" : "now",
    startsAt: values.startsAt,
    venueId: values.venueId,
    latitude: values.latitude,
    longitude: values.longitude,
    accuracy: values.accuracy,
    radius: values.radius ?? "",
    rewardMarks: values.rewardMarks ?? "",
    qrRequired: formBoolean(formData, "qrRequired"),
    qrSeconds: values.qrSeconds || undefined,
  });
  if (!parsed.success) return invalid(parsed.error, values);
  const input = parsed.data;

  let startsAt: string | null = null;
  if (input.when === "later" && input.startsAt) {
    // Ghana is UTC+0 all year.
    const date = new Date(`${input.startsAt}:00Z`);
    if (Number.isNaN(date.getTime())) return failed("Choose a date and time.", values);
    if (date.getTime() < Date.now()) return failed("Choose a time that has not passed, or start now.", values);
    startsAt = date.toISOString();
  }

  const { data, error } = await supabase.rpc("start_session", {
    p_course_run_id: input.courseRunId,
    p_minutes: input.minutes,
    p_starts_at: startsAt,
    p_venue_id: input.venueId === "none" || input.venueId === "current" ? null : input.venueId,
    p_lat: input.venueId === "current" ? Number(input.latitude) : null,
    p_lng: input.venueId === "current" ? Number(input.longitude) : null,
    p_accuracy: input.venueId === "current" ? Number(input.accuracy) : null,
    p_radius_m: input.radius === "" || input.radius === undefined ? null : input.radius,
    p_reward_marks: input.rewardMarks,
    p_qr_required: input.qrRequired,
    p_qr_seconds: input.qrSeconds,
  });
  if (error) return failed(error, values);
  redirect(`/dashboard/sessions/${data.id}`);
}

export async function endSession(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireStaff();
  const sessionId = String(formData.get("sessionId") ?? "");
  const { error } = await supabase.rpc("end_session", { p_session_id: sessionId, p_reason: null });
  if (error) return failed(error);
  refresh();
  return succeeded("Session ended.");
}

export async function cancelScheduled(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc("end_session", { p_session_id: String(formData.get("sessionId") ?? "") });
  if (error) return failed(error);
  redirect("/dashboard/sessions");
}

function reasonFrom(formData: FormData) {
  return sessionReasonSchema.safeParse(formData.get("reason") ?? "");
}

export async function voidSession(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireStaff();
  const reason = reasonFrom(formData);
  if (!reason.success) return { status: "error", message: reason.error.issues[0]?.message ?? "Give a reason." };
  const { error } = await supabase.rpc("void_session", {
    p_session_id: String(formData.get("sessionId") ?? ""),
    p_reason: reason.data,
  });
  if (error) return failed(error);
  refresh();
  return succeeded("Session cancelled.");
}

export async function addCheckin(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireStaff();
  const reason = reasonFrom(formData);
  if (!reason.success) return { status: "error", message: reason.error.issues[0]?.message ?? "Give a reason." };
  const { error } = await supabase.rpc("add_checkin_manually", {
    p_session_id: String(formData.get("sessionId") ?? ""),
    p_student_id: String(formData.get("studentId") ?? ""),
    p_reason: reason.data,
  });
  if (error) return failed(error);
  refresh();
  return succeeded("Marked present.");
}

export async function removeCheckin(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireStaff();
  const reason = reasonFrom(formData);
  if (!reason.success) return { status: "error", message: reason.error.issues[0]?.message ?? "Give a reason." };
  const { error } = await supabase.rpc("remove_checkin", {
    p_session_id: String(formData.get("sessionId") ?? ""),
    p_student_id: String(formData.get("studentId") ?? ""),
    p_reason: reason.data,
  });
  if (error) return failed(error);
  refresh();
  return succeeded("Check-in removed.");
}

export async function addVenue(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireStaff();
  const values = formValues(formData);
  const parsed = venueSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);
  const { latitude, longitude, name, radius } = parsed.data;
  const { error } = await supabase.rpc("add_venue", {
    p_school_id: member.school.id,
    p_name: name,
    p_lat: latitude,
    p_lng: longitude,
    p_radius_m: radius,
  });
  if (error) return failed(error, values);
  // The session form's venue list is on another page; make sure it is fresh there too.
  revalidatePath("/dashboard", "layout");
  return succeeded(member.role === "admin" ? `${name} saved.` : `${name} saved. Other lecturers can use it now; an admin will verify it.`);
}

export async function verifyVenue(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("verify_venue", { p_venue_id: String(formData.get("venueId") ?? "") });
  if (error) return failed(error);
  revalidatePath("/dashboard", "layout");
  return succeeded("Verified.");
}

export async function removeVenue(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc("remove_venue", { p_venue_id: String(formData.get("venueId") ?? "") });
  if (error) return failed(error);
  revalidatePath("/dashboard", "layout");
  return succeeded("Venue removed.");
}

export async function approvePhone(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("approve_device", { p_device_id: String(formData.get("deviceId") ?? "") });
  if (error) return failed(error);
  refresh();
  return succeeded("Approved.");
}

/** The current rotating code for the lecturer's screen, or null when the session is not open. */
export async function currentQr(sessionId: string): Promise<{ token: string; expiresAt: string } | null> {
  const { supabase } = await requireStaff();
  const { data, error } = await supabase.rpc("session_qr", { p_session_id: sessionId });
  const row = data?.[0];
  if (error || !row) return null;
  return { token: row.token, expiresAt: row.expires_at };
}
