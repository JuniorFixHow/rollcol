import { Ionicons } from "@expo/vector-icons";
import { buildClassReport, buildCourseReport, isBelow, markLetter } from "@rollcol/shared";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
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

interface Loaded {
  lines: Line[];
  held: number;
  csv: (string | number | null)[][];
}

async function loadClass(id: string, periodId: string | null): Promise<Loaded> {
  const { data, error } = await supabase.rpc("class_register_days", { p_class_id: id, p_period_id: periodId });
  if (error) throw error;
  const report = buildClassReport(data ?? []);
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

async function loadCourse(id: string): Promise<Loaded> {
  const { data, error } = await supabase.rpc("course_run_report", { p_course_run_id: id });
  if (error) throw error;
  const report = buildCourseReport(data ?? []);
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

export default function ReportScreen() {
  const { kind, id, title, period, periodName } = useLocalSearchParams<{
    kind: string;
    id: string;
    title?: string;
    period?: string;
    periodName?: string;
  }>();
  const { member } = useSession();
  const palette = usePalette();
  const isClass = kind === "class";
  const [data, setData] = useState<Loaded | null>(null);
  const [threshold, setThreshold] = useState(75);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const schoolId = member && member.kind !== "none" ? member.school.id : "";

  const load = useCallback(async () => {
    try {
      const [loaded, percent] = await Promise.all([
        isClass ? loadClass(id, period ?? null) : loadCourse(id),
        schoolId ? lowAttendancePercent(schoolId) : Promise.resolve(75),
      ]);
      setData(loaded);
      setThreshold(percent);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [id, isClass, period, schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = (data?.lines ?? []).filter((line) => {
    const text = `${line.name} ${line.schoolNumber ?? ""}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
  const below = (data?.lines ?? []).filter((line) => isBelow(line.rate, threshold)).length;
  const name = `${title ?? (isClass ? "Class" : "Course")} ${periodName ?? "attendance"}`;

  async function share() {
    if (!data) return;
    setShareError(null);
    setSharing(true);
    try {
      const ok = await shareCsv(name, data.csv);
      if (!ok) setShareError("This phone cannot share files. Download the report on the RollCol website instead.");
    } catch {
      setShareError("RollCol could not prepare the file. Try again.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: title ?? "Report" }} />
      <FlatList
        data={shown}
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
            {data ? (
              <Card>
                <Text style={[styles.big, { color: palette.text }]}>
                  {data.held} {isClass ? (data.held === 1 ? "school day" : "school days") : data.held === 1 ? "session" : "sessions"}
                </Text>
                <Text style={{ color: palette.muted }}>
                  {periodName && isClass ? `${periodName} · ` : ""}
                  {data.lines.length} students
                  {below > 0 ? ` · ${below} below ${threshold}%` : ""}
                </Text>
              </Card>
            ) : null}
            {data && data.held > 0 && data.lines.length > 0 ? (
              <>
                <Button label="Share as a spreadsheet" variant="secondary" busy={sharing} onPress={() => void share()} />
                <Body muted>
                  A CSV file that Excel and Google Sheets open. For the full register with colours, download Excel on the RollCol website.
                </Body>
              </>
            ) : null}
            {shareError ? <Message>{shareError}</Message> : null}
            {data && data.lines.length > 8 ? (
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
          data && words.length === 0 ? (
            <Empty icon="bar-chart-outline">
              {data.held === 0
                ? isClass
                  ? "No registers have been taken for this class this term yet."
                  : "No sessions have been held for this course yet."
                : "No students yet."}
            </Empty>
          ) : undefined
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
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 10 },
  header: { gap: 12, marginBottom: 4 },
  big: { fontSize: 28, fontWeight: "700" },
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14 },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  search: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 10 },
});
