import { type Database, describeDatabaseError, sessionQrPayload, sessionState } from "@rollcol/shared";
import { useKeepAwake } from "expo-keep-awake";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SvgXml } from "react-native-svg";
import { renderSVG } from "uqr";
import { ConfirmDialog, ReasonDialog } from "@/components/dialog";
import { Badge } from "@/components/kit";
import { usePalette } from "@/components/theme";
import { Body, Button, Card, Message } from "@/components/ui";
import { formatDayTime, formatDuration, formatTime } from "@/lib/format";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

type RosterRow = Database["public"]["Functions"]["session_roster"]["Returns"][number];

interface SessionInfo {
  id: string;
  starts_at: string;
  ends_at: string;
  voided_at: string | null;
  void_reason: string | null;
  qr_required: boolean;
  qr_seconds: number;
  radius_m: number | null;
  reward_marks: number;
  venue: { name: string } | null;
  course_run: { course: { code: string; title: string } | null } | null;
}

type Pending =
  | { kind: "end" }
  | { kind: "void" }
  | { kind: "add"; student: RosterRow }
  | { kind: "remove"; student: RosterRow };

/** The code students scan, refreshed when it changes. Keeps the screen on. */
function LiveCode({ sessionId }: { sessionId: string }) {
  useKeepAwake();
  const { width } = useWindowDimensions();
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      const { data } = await supabase.rpc("session_qr", { p_session_id: sessionId });
      if (cancelled) return;
      const row = data?.[0];
      if (!row) {
        setSvg(null);
        timer = setTimeout(load, 5000);
        return;
      }
      setSvg(renderSVG(sessionQrPayload(sessionId, row.token), { border: 2, ecc: "M" }));
      timer = setTimeout(load, Math.max(1000, new Date(row.expires_at).getTime() - Date.now() + 300));
    };
    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId]);

  const size = Math.min(width - 72, 320);
  return (
    <View style={[styles.qr, { width: size + 16, height: size + 16 }]}>
      {svg ? <SvgXml xml={svg} width={size} height={size} /> : <Body muted>Loading code...</Body>}
    </View>
  );
}

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { member } = useSession();
  const palette = usePalette();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [rules, setRules] = useState({ removeSelf: false, afterEnd: false });
  const [failed, setFailed] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [, setTick] = useState(0);
  const schoolId = member && member.kind !== "none" ? member.school.id : "";
  const isAdmin = member?.kind === "staff" && member.role === "admin";

  const load = useCallback(async () => {
    const [sessionResult, rosterResult, rulesResult] = await Promise.all([
      supabase
        .from("attendance_sessions")
        .select(
          "id, starts_at, ends_at, voided_at, void_reason, qr_required, qr_seconds, radius_m, reward_marks, venue:venues(name), course_run:course_runs(course:courses(code, title))",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase.rpc("session_roster", { p_session_id: id }),
      supabase
        .from("school_settings")
        .select("lecturers_remove_self_checkins, lecturers_add_after_end")
        .eq("school_id", schoolId)
        .maybeSingle(),
    ]);
    if (sessionResult.error || !sessionResult.data || rosterResult.error) {
      setFailed("This session could not be loaded. Only its course's lecturers and admins can open it.");
      return;
    }
    setFailed(null);
    setSession(sessionResult.data);
    setRoster(rosterResult.data ?? []);
    setRules({
      removeSelf: rulesResult.data?.lecturers_remove_self_checkins ?? false,
      afterEnd: rulesResult.data?.lecturers_add_after_end ?? false,
    });
  }, [id, schoolId]);

  // Live: reload when someone checks in or is changed, at most once a second.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  useEffect(() => {
    void loadRef.current();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        void loadRef.current();
      }, 1000);
    };
    const channel = supabase
      .channel(`session-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "session_checkins", filter: `session_id=eq.${id}` }, soon)
      .subscribe();
    // The countdown, and opening or closing on time.
    const clock = setInterval(() => setTick((value) => value + 1), 15000);
    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(clock);
      void supabase.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    if (!session) return;
    const next = [session.starts_at, session.ends_at]
      .map((value) => new Date(value).getTime() - Date.now())
      .filter((ms) => ms > 0 && ms < 2 ** 31 - 1)
      .sort((a, b) => a - b)[0];
    if (next === undefined) return;
    const timer = setTimeout(() => void loadRef.current(), next + 1000);
    return () => clearTimeout(timer);
  }, [session]);

  async function act(reason: string | null) {
    if (!pending) return;
    setBusy(true);
    setActionError(null);
    const result =
      pending.kind === "end"
        ? await supabase.rpc("end_session", { p_session_id: id })
        : pending.kind === "void"
          ? await supabase.rpc("void_session", { p_session_id: id, p_reason: reason ?? "" })
          : pending.kind === "add"
            ? await supabase.rpc("add_checkin_manually", {
                p_session_id: id,
                p_student_id: pending.student.student_id,
                p_reason: reason ?? "",
              })
            : await supabase.rpc("remove_checkin", {
                p_session_id: id,
                p_student_id: pending.student.student_id,
                p_reason: reason ?? "",
              });
    setBusy(false);
    if (result.error) {
      setActionError(describeDatabaseError(result.error));
      return;
    }
    setPending(null);
    await load();
  }

  if (failed) {
    return (
      <View style={styles.content}>
        <Message>{failed}</Message>
      </View>
    );
  }
  if (!session) return null;

  const state = sessionState(session);
  const present = roster.filter((row) => row.checked_in_at !== null).length;
  const canChangeAfterEnd = isAdmin || rules.afterEnd;
  const canRemoveSelf = isAdmin || rules.removeSelf;
  const withinWindow = new Date(session.ends_at).getTime() > Date.now() - 14 * 24 * 60 * 60 * 1000;
  const correctable = state === "open" || (state === "ended" && canChangeAfterEnd && withinWindow);
  const course = session.course_run?.course;

  return (
    <>
      <Stack.Screen options={{ title: course?.code ?? "Session" }} />
      <FlatList
        data={roster}
        keyExtractor={(row) => row.student_id}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={palette.accent}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.text }]}>{course?.title}</Text>
            <Body muted>
              {formatDayTime(session.starts_at)} to {formatTime(session.ends_at)} ·{" "}
              {session.venue?.name ?? (session.radius_m ? `Lecturer's location (${session.radius_m} m)` : "No location check")}
              {session.reward_marks > 0 ? ` · ${session.reward_marks} marks` : ""}
            </Body>
            {state === "void" ? <Message>This session was cancelled. Reason: {session.void_reason}</Message> : null}

            <Card>
              <View style={styles.countRow}>
                <View style={styles.flex}>
                  <Text style={[styles.count, { color: palette.text }]}>
                    {present}
                    <Text style={[styles.countOf, { color: palette.muted }]}> of {roster.length}</Text>
                  </Text>
                  <Body muted>
                    {state === "open"
                      ? `checked in · closes in ${formatDuration(new Date(session.ends_at).getTime() - Date.now())}`
                      : state === "scheduled"
                        ? `opens at ${formatTime(session.starts_at)}`
                        : "checked in · closed"}
                  </Body>
                </View>
                <Badge tone={state === "open" ? "success" : state === "scheduled" ? "accent" : state === "void" ? "danger" : "neutral"}>
                  {state === "open" ? "Open" : state === "scheduled" ? "Scheduled" : state === "void" ? "Cancelled" : "Ended"}
                </Badge>
              </View>
            </Card>

            {session.qr_required && state === "open" ? (
              <Card>
                <View style={styles.center}>
                  <LiveCode sessionId={session.id} />
                  <Body muted>Students scan this. It changes every {session.qr_seconds} seconds. Your screen stays on.</Body>
                </View>
              </Card>
            ) : null}

            {state === "open" ? (
              <View style={styles.actions}>
                <View style={styles.flex}>
                  <Button label="End now" variant="secondary" onPress={() => setPending({ kind: "end" })} />
                </View>
                <View style={styles.flex}>
                  <Button label="Cancel session" variant="danger" onPress={() => setPending({ kind: "void" })} />
                </View>
              </View>
            ) : state === "ended" ? (
              <Button label="Cancel session" variant="secondary" onPress={() => setPending({ kind: "void" })} />
            ) : null}

            {state === "ended" && !canChangeAfterEnd ? (
              <Body muted>Your school only lets admins change attendance after a session ends.</Body>
            ) : null}
            {!canRemoveSelf && (state === "open" || state === "ended") ? (
              <Body muted>Students who checked in themselves can only be removed by an admin.</Body>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const canRemove = correctable && item.checked_in_at !== null && (item.method !== "self" || canRemoveSelf);
          const canAdd = correctable && item.checked_in_at === null;
          return (
            <View style={[styles.row, { backgroundColor: palette.surface, borderColor: palette.line }]}>
              <View style={styles.flex}>
                <Text style={[styles.name, { color: palette.text }]}>{item.full_name}</Text>
                <Text style={{ color: palette.muted }}>
                  {item.school_number ?? "No school ID"}
                  {item.checked_in_at
                    ? ` · ${formatTime(item.checked_in_at)}${item.distance_m !== null ? ` · ${Math.round(item.distance_m)} m` : ""}${item.method === "manual" ? " · added by hand" : ""}`
                    : ""}
                </Text>
              </View>
              {item.checked_in_at ? (
                <Badge tone="success">Present</Badge>
              ) : (
                <Badge>{state === "open" || state === "scheduled" ? "Not yet" : "Missed"}</Badge>
              )}
              {canAdd || canRemove ? (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => setPending(canAdd ? { kind: "add", student: item } : { kind: "remove", student: item })}
                >
                  <Text style={[styles.rowAction, { color: canAdd ? palette.accent : palette.danger }]}>
                    {canAdd ? "Add" : "Remove"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />

      <ConfirmDialog
        visible={pending?.kind === "end"}
        title="End this session now?"
        message="Students who have not checked in can no longer do so."
        confirmLabel="End now"
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={() => void act(null)}
      />
      <ReasonDialog
        visible={pending?.kind === "void" || pending?.kind === "add" || pending?.kind === "remove"}
        title={
          pending?.kind === "void"
            ? "Cancel this session?"
            : pending?.kind === "add"
              ? `Mark ${pending.student.full_name} present?`
              : pending?.kind === "remove"
                ? `Remove ${pending.student.full_name}'s check-in?`
                : ""
        }
        message={
          pending?.kind === "void"
            ? "It will not count for attendance or marks. Students who checked in are told, with your reason."
            : pending?.kind === "add"
              ? "For example, their new phone is in its 48 hours, or their battery died. They are told, with your reason."
              : "They will be counted as absent, and told with your reason."
        }
        confirmLabel={pending?.kind === "void" ? "Cancel session" : pending?.kind === "add" ? "Mark present" : "Remove"}
        placeholder={pending?.kind === "add" ? "Battery died" : pending?.kind === "void" ? "Opened for the wrong course" : "Not in class"}
        danger={pending?.kind !== "add"}
        busy={busy}
        error={actionError}
        onCancel={() => {
          setPending(null);
          setActionError(null);
        }}
        onConfirm={(reason) => void act(reason)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 10, paddingBottom: 40 },
  header: { gap: 12, marginBottom: 6 },
  title: { fontSize: 20, fontWeight: "700" },
  countRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  count: { fontSize: 36, fontWeight: "700" },
  countOf: { fontSize: 20, fontWeight: "600" },
  center: { alignItems: "center", gap: 12 },
  qr: { backgroundColor: "#ffffff", borderRadius: 12, alignItems: "center", justifyContent: "center", padding: 8 },
  actions: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12 },
  name: { fontSize: 16, fontWeight: "600" },
  rowAction: { fontSize: 15, fontWeight: "600", paddingLeft: 4 },
});
