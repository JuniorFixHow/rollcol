import type { Database } from "@rollcol/shared";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

export type OpenSession = Database["public"]["Functions"]["my_open_sessions"]["Returns"][number];

let channelCount = 0;

/**
 * Reloads when the screen comes into view, when a session in the school is
 * added or changed (live), and at the moment the next session opens or closes.
 */
function useLiveReload(load: () => Promise<void>, schoolId: string, times: string[], channelName: string) {
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void loadRef.current();
    }, []),
  );

  useEffect(() => {
    // Each screen needs its own channel: two tabs can watch the same school.
    channelCount += 1;
    const channel = supabase
      .channel(`${channelName}-${schoolId}-${channelCount}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_sessions", filter: `school_id=eq.${schoolId}` },
        () => void loadRef.current(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [schoolId, channelName]);

  const key = times.join("|");
  useEffect(() => {
    const now = Date.now();
    const next = key
      .split("|")
      .filter(Boolean)
      .map((value) => new Date(value).getTime())
      .filter((at) => at > now)
      .sort((a, b) => a - b)[0];
    if (next === undefined || next - now > 2 ** 31 - 1) return;
    const timer = setTimeout(() => void loadRef.current(), next - now + 1000);
    return () => clearTimeout(timer);
  }, [key]);
}

/** A student's sessions that are open now, or start in the next 12 hours, in one school. */
export function useOpenSessions(schoolId: string) {
  const [sessions, setSessions] = useState<OpenSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("my_open_sessions");
    setLoading(false);
    if (error) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setSessions((data ?? []).filter((row) => row.school_id === schoolId));
  }, [schoolId]);

  useLiveReload(load, schoolId, sessions.flatMap((s) => [s.starts_at, s.ends_at]), "student-sessions");
  return { sessions, loading, failed, reload: load };
}

export interface LecturerSession {
  id: string;
  starts_at: string;
  ends_at: string;
  voided_at: string | null;
  qr_required: boolean;
  radius_m: number | null;
  venue: { name: string } | null;
  course_run: { course: { code: string; title: string } | null; enrolments: { count: number }[] } | null;
  session_checkins: { count: number }[];
}

/** Sessions a lecturer (or admin) can run: open, scheduled, and the last two weeks. */
export function useLecturerSessions(schoolId: string) {
  const [sessions, setSessions] = useState<LecturerSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("attendance_sessions")
      .select(
        "id, starts_at, ends_at, voided_at, qr_required, radius_m, venue:venues(name), course_run:course_runs(course:courses(code, title), enrolments(count)), session_checkins(count)",
      )
      .eq("school_id", schoolId)
      .gte("ends_at", since)
      .order("starts_at", { ascending: false })
      .limit(60);
    setLoading(false);
    if (error) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setSessions(data ?? []);
  }, [schoolId]);

  useLiveReload(load, schoolId, sessions.flatMap((s) => [s.starts_at, s.ends_at]), "lecturer-sessions");
  return { sessions, loading, failed, reload: load };
}
