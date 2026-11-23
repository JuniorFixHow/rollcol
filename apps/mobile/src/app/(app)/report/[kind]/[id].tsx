import { Ionicons } from "@expo/vector-icons";
import {
  type CourseReportRow,
  type RegisterDayRow,
  type ReportView,
  buildClassReport,
  buildCourseReport,
  inView,
  isBelow,
  markLetter,
  mondayOf,
  parseView,
  rangeLabel,
  todayIso,
  viewLabel,
} from "@rollcol/shared";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { CalendarDialog } from "@/components/calendar-dialog";
import { Badge, Empty } from "@/components/kit";
import { usePalette } from "@/components/theme";
import { Body, Button, Card, Message } from "@/components/ui";
import { formatDay, formatTime } from "@/lib/format";
import { lowAttendancePercent, shareCsv } from "@/lib/reports";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

/** One line per student, the same for classes and courses. */
interface Line {
  id: string;
  name: string;
  schoolNumber: string | null;
  attended: number;
  held: number;
  rate: number | null;
  detail: string;
}

interface Built {
  lines: Line[];
  held: number;
  csv: (string | number | null)[][];
}

type Raw = { kind: "class"; rows: RegisterDayRow[] } | { kind: "course"; rows: CourseReportRow[] };

/** Every date is loaded once; the view only filters, so moving between weeks is instant. */
async function loadRaw(kind: string, id: string): Promise<Raw> {
  if (kind === "class") {
    const { data, error } = await supabase.rpc("class_register_days", { p_class_id: id, p_period_id: null });
    if (error) throw error;
    return { kind: "class", rows: data ?? [] };
  }
  const { data, error } = await supabase.rpc("course_run_report", { p_course_run_id: id });
  if (error) throw error;
  return { kind: "course", rows: data ?? [] };
}

function buildClass(rows: RegisterDayRow[]): Built {
  const report = buildClassReport(rows);
  return {
    held: report.days.length,
    lines: report.students.map((s) => ({
      id: s.id,
      name: s.name,
      schoolNumber: s.schoolNumber,
      attended: s.attended,
      held: s.held,
      rate: s.rate,
      detail: `${s.present} present · ${s.late} late · ${s.absent} absent`,
    })),
    csv: [
      ["Name", "School ID", ...report.days, "Present", "Late", "Absent", "Attendance", "%"],
      ...report.students.map((s) => [
        s.name,
        s.schoolNumber,
        ...report.days.map((d) => markLetter(s.marks[d] ?? null)),
        s.present,
        s.late,
        s.absent,
        `${s.attended} out of ${s.held}`,
        s.rate,
      ]),
    ],
  };
}

function buildCourse(rows: CourseReportRow[]): Built {
  const report = buildCourseReport(rows);
  const label = (iso: string) => `${formatDay(iso)} ${formatTime(iso)}`;
  return {
    held: report.sessions.length,
    lines: report.students.map((s) => ({
      id: s.id,
      name: s.name,
      schoolNumber: s.schoolNumber,
      attended: s.attended,
      held: s.held,
      rate: s.rate,
      detail: s.rewardMarks > 0 ? `${s.rewardMarks} marks` : "",
    })),
    csv: [
      ["Name", "School ID", ...report.sessions.map((s) => label(s.startsAt)), "Attended", "Sessions", "%", "Marks"],
      ...report.students.map((s) => [
        s.name,
        s.schoolNumber,
        ...report.sessions.map((session) => {
          const method = s.sessions[session.id];
          return method === "manual" ? "P*" : method ? "P" : "A";
        }),
        s.attended,
        s.held,
        s.rate,
        s.rewardMarks,
      ]),
    ],
  };
}

function weekView(anyDay: string): ReportView {
  return parseView({ week: anyDay });
}

export default function ReportScreen() {
  const { kind, id, title, periodName, periodStart, periodEnd } = useLocalSearchParams<{
    kind: string;
    id: string;
    title?: string;
    periodName?: string;
    periodStart?: string;
    periodEnd?: string;
  }>();
  const { member } = useSession();
  const palette = usePalette();
  const isClass = kind === "class";
  const [raw, setRaw] = useState<Raw | null>(null);
  const [view, setView] = useState<ReportView>(() => weekView(todayIso()));
  const [picking, setPicking] = useState<"from" | "to" | null>(null);
  const [threshold, setThreshold] = useState(75);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const schoolId = member && member.kind !== "none" ? member.school.id : "";

  const load = useCallback(async () => {
    try {
      const [loaded, percent] = await Promise.all([loadRaw(kind, id), schoolId ? lowAttendancePercent(schoolId) : Promise.resolve(75)]);
      setRaw(loaded);
      setThreshold(percent);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [id, kind, schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  // "All" for a class is its term; a course's sessions all belong to its semester.
  const allView: ReportView =
    isClass && periodStart && periodEnd ? { mode: "range", from: periodStart, to: periodEnd } : { mode: "all" };
  const filterView = view.mode === "all" ? allView : view;
  const data: Built | null = raw
    ? raw.kind === "class"
      ? buildClass(raw.rows.filter((row) => inView(filterView, row.day)))
      : buildCourse(raw.rows.filter((row) => inView(filterView, row.starts_at)))
    : null;

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = (data?.lines ?? []).filter((line) => {
    const text = `${line.name} ${line.schoolNumber ?? ""}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
  const below = (data?.lines ?? []).filter((line) => isBelow(line.rate, threshold)).length;
  const allLabel = isClass ? `Whole term${periodName ? `: ${periodName}` : ""}` : "Whole semester";
  const label = viewLabel(view, allLabel);
  const fileName = `${title ?? (isClass ? "Class" : "Course")} ${view.mode === "all" ? (periodName ?? "attendance") : `${view.from} to ${view.to}`}`;
  const thisWeek = mondayOf(todayIso());

  async function share() {
    if (!data) return;
    setShareError(null);
    setSharing(true);
    try {
      const ok = await shareCsv(fileName, data.csv);
      if (!ok) setShareError("This phone cannot share files. Download the report on the RollCol website instead.");
    } catch {
      setShareError("RollCol could not prepare the file. Try again.");
    } finally {
      setSharing(false);
    }
  }

  function choose(mode: ReportView["mode"]) {
    setQuery("");
    if (mode === "week") setView(weekView(todayIso()));
    else if (mode === "all") setView({ mode: "all" });
    else setView({ mode: "range", from: view.mode === "all" ? thisWeek : view.from, to: todayIso() });
  }

  function pickDate(date: string) {
    if (view.mode !== "range") return;
    // A reversed range is swapped, as on the website.
    const from = picking === "from" ? date : view.from;
    const to = picking === "to" ? date : view.to;
    setView(from <= to ? { mode: "range", from, to } : { mode: "range", from: to, to: from });
    setPicking(null);
  }

  const empty =
    view.mode === "week"
      ? isClass
        ? "No registers were taken this week. Use the arrows to see other weeks."
        : "No sessions were held this week. Use the arrows to see other weeks."
      : view.mode === "range"
        ? isClass
          ? "No registers were taken between these dates."
          : "No sessions were held between these dates."
        : isClass
          ? "No registers have been taken for this class this term yet."
          : "No sessions have been held for this course yet.";

  return (
    <>
      <Stack.Screen options={{ title: title ?? "Report" }} />
      <FlatList
        data={data && data.held > 0 ? shown : []}
        keyExtractor={(line) => line.id}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
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
            {failed ? <Message tone="warning">RollCol could not load this report. Pull down to try again.</Message> : null}

            <View style={[styles.segments, { backgroundColor: palette.surfaceMuted }]} accessibilityRole="tablist">
              {(
                [
                  ["week", "Week"],
                  ["all", "All"],
                  ["range", "Dates"],
                ] as const
              ).map(([mode, text]) => {
                const active = view.mode === mode;
                return (
                  <Pressable
                    key={mode}
                    onPress={() => choose(mode)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    style={[styles.segment, active ? { backgroundColor: palette.surface } : null]}
                  >
                    <Text style={[styles.segmentText, { color: active ? palette.text : palette.muted }]}>{text}</Text>
                  </Pressable>
                );
              })}
            </View>

            {view.mode === "week" ? (
              <View style={styles.weekRow}>
                <Pressable
                  onPress={() => setView(weekView(view.previous))}
                  accessibilityRole="button"
                  accessibilityLabel="Previous week"
                  hitSlop={6}
                  style={[styles.arrow, { borderColor: palette.line }]}
                >
                  <Ionicons name="chevron-back" size={20} color={palette.text} />
                </Pressable>
                <View style={styles.flex}>
                  <Text style={[styles.weekLabel, { color: palette.text }]}>{rangeLabel(view.from, view.to)}</Text>
                  {view.isThisWeek ? (
                    <Text style={[styles.small, { color: palette.muted }]}>This week</Text>
                  ) : (
                    <Pressable onPress={() => setView(weekView(todayIso()))} accessibilityRole="button" hitSlop={6}>
                      <Text style={[styles.small, { color: palette.accent }]}>Back to this week</Text>
                    </Pressable>
                  )}
                </View>
                <Pressable
                  onPress={() => setView(weekView(view.next))}
                  accessibilityRole="button"
                  accessibilityLabel="Next week"
                  hitSlop={6}
                  style={[styles.arrow, { borderColor: palette.line }]}
                >
                  <Ionicons name="chevron-forward" size={20} color={palette.text} />
                </Pressable>
              </View>
            ) : null}

            {view.mode === "range" ? (
              <View style={styles.rangeRow}>
                {(["from", "to"] as const).map((end) => (
                  <Pressable
                    key={end}
                    onPress={() => setPicking(end)}
                    accessibilityRole="button"
                    style={[styles.dateButton, { borderColor: palette.line, backgroundColor: palette.surface }]}
                  >
                    <Text style={[styles.small, { color: palette.muted }]}>{end === "from" ? "From" : "To"}</Text>
                    <Text style={[styles.dateText, { color: palette.text }]}>{rangeLabel(view[end], view[end])}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {view.mode === "all" ? <Text style={[styles.weekLabel, { color: palette.text }]}>{allLabel}</Text> : null}

            {data && data.held > 0 ? (
              <Card>
                <Text style={[styles.big, { color: palette.text }]}>
                  {data.held} {isClass ? (data.held === 1 ? "school day" : "school days") : data.held === 1 ? "session" : "sessions"}
                </Text>
                <Text style={{ color: palette.muted }}>
                  {label} · {data.lines.length} students
                  {below > 0 ? ` · ${below} below ${threshold}%` : ""}
                </Text>
              </Card>
            ) : null}

            {data && data.held > 0 && data.lines.length > 0 ? (
              <>
                <Button label="Share as a spreadsheet" variant="secondary" busy={sharing} onPress={() => void share()} />
                <Body muted>
                  A CSV file with the {view.mode === "all" ? `whole ${isClass ? "term" : "semester"}` : "dates shown"}, which Excel and Google Sheets open.
                </Body>
              </>
            ) : null}
            {shareError ? <Message>{shareError}</Message> : null}
            {data && data.held > 0 && data.lines.length > 8 ? (
              <View style={[styles.search, { borderColor: palette.line, backgroundColor: palette.surface }]}>
                <Ionicons name="search" size={18} color={palette.muted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search by name or school ID"
                  placeholderTextColor={palette.muted}
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                  returnKeyType="search"
                  style={[styles.searchInput, { color: palette.text }]}
                />
              </View>
            ) : null}
            {words.length > 0 && data ? (
              <Body muted>{shown.length === 0 ? `Nothing matches "${query.trim()}".` : `Showing ${shown.length} of ${data.lines.length}.`}</Body>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          data && words.length === 0 ? <Empty icon="bar-chart-outline">{data.held === 0 ? empty : "No students yet."}</Empty> : undefined
        }
        renderItem={({ item }) => {
          const low = isBelow(item.rate, threshold);
          return (
            <View style={[styles.row, { backgroundColor: palette.surface, borderColor: palette.line }]}>
              <View style={styles.flex}>
                <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={{ color: palette.muted }}>
                  {isClass ? `Attendance ${item.attended} out of ${item.held}` : `${item.attended} of ${item.held} sessions`}
                  {item.detail ? `\n${item.detail}` : ""}
                </Text>
              </View>
              {item.rate === null ? null : <Badge tone={low ? "danger" : "neutral"}>{`${item.rate}%`}</Badge>}
            </View>
          );
        }}
      />
      <CalendarDialog
        visible={picking !== null}
        title={picking === "from" ? "From" : "To"}
        value={view.mode === "range" ? (picking === "to" ? view.to : view.from) : todayIso()}
        onChoose={pickDate}
        onClose={() => setPicking(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 10 },
  header: { gap: 12, marginBottom: 4 },
  segments: { flexDirection: "row", borderRadius: 10, padding: 4 },
  segment: { flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  segmentText: { fontSize: 15, fontWeight: "600" },
  weekRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  arrow: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 8 },
  weekLabel: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  small: { fontSize: 13, textAlign: "center" },
  rangeRow: { flexDirection: "row", gap: 10 },
  dateButton: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10, gap: 2 },
  dateText: { fontSize: 15, fontWeight: "600" },
  big: { fontSize: 28, fontWeight: "700" },
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14 },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  search: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 10 },
});
