import {
  ABSENCE_REASONS,
  ATTENDANCE_MARKS,
  ATTENDANCE_MARK_LABELS,
  type AttendanceMark,
  type RegisterMarks,
  isAbsenceReason,
  marksLabel,
  periodLabel,
} from "@rollcol/shared";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { ConfirmDialog } from "@/components/dialog";
import { type Palette, usePalette } from "@/components/theme";
import { supabase } from "@/lib/supabase";
import { Body, Button, Message } from "@/components/ui";
import {
  type LocalRegister,
  type RosterStudent,
  ghanaToday,
  loadRegister,
  loadRoster,
  saveMarks,
  submitRegister,
  syncOutbox,
  useSyncState,
} from "@/lib/registers";

const SYNC_DELAY_MS = 800;

function markColours(palette: Palette): Record<AttendanceMark, { bg: string; fg: string }> {
  return {
    present: { bg: palette.success, fg: palette.onStatus },
    late: { bg: palette.warning, fg: palette.onWarning },
    absent: { bg: palette.danger, fg: palette.onStatus },
  };
}

function formatTime(value: string | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra" }).format(new Date(value));
}

export default function RegisterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const palette = usePalette();
  const colours = markColours(palette);
  const sync = useSyncState();
  const [register, setRegister] = useState<LocalRegister | null>(null);
  const [students, setStudents] = useState<RosterStudent[]>([]);
  // Parents' absence reports for this day (online only; the register works without them).
  const [reported, setReported] = useState<Record<string, string>>({});
  const [marks, setMarks] = useState<RegisterMarks>({});
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [askSubmit, setAskSubmit] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const sheet = await loadRegister(id);
      const roster = await loadRoster(sheet.classId);
      setRegister(sheet);
      setMarks(sheet.marks);
      setStudents(roster);
      setError(null);
      void supabase
        .from("absence_reports")
        .select("student_id, reason, note")
        .eq("status", "active")
        .lte("from_date", sheet.date)
        .gte("to_date", sheet.date)
        .then(({ data }) => {
          const next: Record<string, string> = {};
          for (const r of data ?? []) {
            next[r.student_id] = `${isAbsenceReason(r.reason) ? ABSENCE_REASONS[r.reason] : r.reason}${r.note ? ` (${r.note})` : ""}`;
          }
          setReported(next);
        });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not load this register.");
    }
  }, [id]);

  useEffect(() => {
    void load();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      // Leaving the screen: send anything still waiting.
      void syncOutbox();
    };
  }, [load]);

  const scheduleSync = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void syncOutbox(), SYNC_DELAY_MS);
  }, []);

  const editable = register !== null && register.date === ghanaToday();

  function setMark(studentId: string, mark: AttendanceMark) {
    if (!editable) return;
    const next = marks[studentId] === mark ? null : mark;
    setMarks((current) => ({ ...current, [studentId]: next }));
    void saveMarks(id, { [studentId]: next }).then(scheduleSync);
  }

  function markRestPresent() {
    const changes: RegisterMarks = {};
    for (const student of students) if (!marks[student.id]) changes[student.id] = "present";
    if (Object.keys(changes).length === 0) return;
    setMarks((current) => ({ ...current, ...changes }));
    void saveMarks(id, changes).then(scheduleSync);
  }

  const counts = useMemo(() => {
    const result = { present: 0, late: 0, absent: 0, notMarked: 0 };
    for (const student of students) {
      const mark = marks[student.id];
      if (mark) result[mark] += 1;
      else result.notMarked += 1;
    }
    return result;
  }, [marks, students]);

  async function doSubmit() {
    setAskSubmit(false);
    setSubmitting(true);
    await submitRegister(id);
    await load();
    setSubmitting(false);
  }

  function confirmSubmit() {
    if (counts.notMarked > 0) setAskSubmit(true);
    else void doSubmit();
  }

  async function onRefresh() {
    setRefreshing(true);
    await syncOutbox();
    await load();
    setRefreshing(false);
  }

  const title = register ? (register.subjectName ? `${register.className}, ${register.subjectName}` : register.className) : "Register";

  if (!register) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        <Stack.Screen options={{ title: "Register" }} />
        {error ? <Message>{error}</Message> : <Body muted>Loading...</Body>}
      </View>
    );
  }

  const header = (
    <View style={styles.header}>
      <Body muted>
        {periodLabel(register.periodNumber)}
        {register.rewardMarks > 0 ? ` · ${marksLabel(register.rewardMarks)} for attending` : ""}
        {register.status === "open" && register.closesAt ? ` · closes at ${formatTime(register.closesAt)}` : ""}
        {register.status === "submitted" ? " · Submitted" : ""}
        {register.status === "closed" ? " · Closed" : ""}
      </Body>
      <Text style={[styles.counts, { color: palette.text }]}>
        <Text style={{ color: palette.success }}>{counts.present} present</Text>
        {"  "}
        <Text style={{ color: palette.warning }}>{counts.late} late</Text>
        {"  "}
        <Text style={{ color: palette.danger }}>{counts.absent} absent</Text>
        {"  "}
        <Text style={{ color: palette.muted }}>{counts.notMarked} not marked</Text>
      </Text>
      {!editable ? <Message tone="warning">This register is from an earlier day, so it can only be viewed here.</Message> : null}
      {editable && register.status !== "open" ? (
        <Message tone="accent">You can still correct marks today, for example when a child arrives late.</Message>
      ) : null}
      {sync.pending > 0 ? (
        <Body muted>Saved on this phone. Sending to RollCol{sync.syncing ? "..." : " when you are online. Pull down to retry."}</Body>
      ) : (
        <Body muted>All marks saved.</Body>
      )}
      {sync.error ? <Message>{sync.error}</Message> : null}
      {editable && counts.notMarked > 0 ? <Button label="Mark the rest present" variant="secondary" onPress={markRestPresent} /> : null}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title }} />
      <FlatList
        data={students}
        keyExtractor={(student) => student.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={palette.accent} />}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: palette.line }]} />}
        renderItem={({ item }) => {
          const current = marks[item.id] ?? null;
          return (
            <View style={styles.row}>
              <View style={styles.name}>
                <Text numberOfLines={1} style={[styles.studentName, { color: palette.text }]}>
                  {item.name}
                </Text>
                {item.number ? <Text style={[styles.number, { color: palette.muted }]}>{item.number}</Text> : null}
                {reported[item.id] ? (
                  <Text numberOfLines={2} style={[styles.number, { color: palette.warning }]}>
                    Parent reported absent: {reported[item.id]}
                  </Text>
                ) : null}
              </View>
              <View style={styles.marks} accessibilityLabel={`Mark ${item.name}`}>
                {ATTENDANCE_MARKS.map((mark) => {
                  const selected = current === mark;
                  const { label, short } = ATTENDANCE_MARK_LABELS[mark];
                  return (
                    <Pressable
                      key={mark}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      accessibilityState={{ selected, disabled: !editable }}
                      disabled={!editable}
                      hitSlop={4}
                      onPress={() => setMark(item.id, mark)}
                      style={[
                        styles.markButton,
                        {
                          backgroundColor: selected ? colours[mark].bg : palette.surface,
                          borderColor: selected ? colours[mark].bg : palette.line,
                        },
                      ]}
                    >
                      <Text style={[styles.markText, { color: selected ? colours[mark].fg : palette.muted }]}>{short}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          editable && register.status === "open" ? (
            <View style={styles.footer}>
              <Button label="Submit register" onPress={confirmSubmit} busy={submitting} />
            </View>
          ) : undefined
        }
      />
      <ConfirmDialog
        visible={askSubmit}
        title="Submit with children not marked?"
        message={`${counts.notMarked} ${counts.notMarked === 1 ? "child is" : "children are"} not marked. Unmarked children are not treated as absent.`}
        confirmLabel="Submit"
        onCancel={() => setAskSubmit(false)}
        onConfirm={() => void doSubmit()}
      />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  content: { padding: 16, paddingBottom: 48 },
  header: { gap: 10, marginBottom: 12 },
  counts: { fontSize: 15, fontWeight: "600" },
  separator: { height: StyleSheet.hairlineWidth },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  name: { flex: 1, minWidth: 0 },
  studentName: { fontSize: 16, fontWeight: "500" },
  number: { fontSize: 12, fontVariant: ["tabular-nums"] },
  marks: { flexDirection: "row", gap: 6 },
  markButton: { width: 44, height: 40, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  markText: { fontSize: 15, fontWeight: "700" },
  footer: { marginTop: 20 },
});
