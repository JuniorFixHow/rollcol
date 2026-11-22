import { fileSlug, toCsv } from "@rollcol/shared";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { ghanaDate } from "./format";
import { supabase } from "./supabase";

export interface Period {
  id: string;
  name: string;
}

/** The term or semester containing today, else the latest. */
export async function currentPeriod(schoolId: string): Promise<Period | null> {
  const { data } = await supabase
    .from("academic_periods")
    .select("id, name, starts_on, ends_on")
    .eq("school_id", schoolId)
    .order("starts_on", { ascending: false });
  const today = ghanaDate();
  const periods = data ?? [];
  const period = periods.find((p) => p.starts_on <= today && today <= p.ends_on) ?? periods[0];
  return period ? { id: period.id, name: period.name } : null;
}

export async function lowAttendancePercent(schoolId: string): Promise<number> {
  const { data } = await supabase.from("school_settings").select("low_attendance_percent").eq("school_id", schoolId).maybeSingle();
  return data?.low_attendance_percent ?? 75;
}

/**
 * Writes a CSV file and opens the share sheet (WhatsApp, email, Drive and so
 * on). Returns false when this phone cannot share files.
 */
export async function shareCsv(name: string, rows: (string | number | null)[][]): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  const file = new File(Paths.cache, `${fileSlug(name)}.csv`);
  file.create({ overwrite: true });
  // The byte order mark tells Excel the file is UTF-8, so names with accents show correctly.
  await file.write(`﻿${toCsv(rows)}`);
  await Sharing.shareAsync(file.uri, { mimeType: "text/csv", UTI: "public.comma-separated-values-text", dialogTitle: name });
  return true;
}
