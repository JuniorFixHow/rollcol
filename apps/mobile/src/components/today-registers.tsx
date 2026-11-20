import { periodLabel } from "@rollcol/shared";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { type TodayRow, loadToday, useSyncState } from "@/lib/registers";
import { usePalette } from "./theme";
import { Body, Message } from "./ui";

function formatTime(value: string | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra" }).format(new Date(value));
}

const STATUS_LABEL = { open: "Open", submitted: "Submitted", closed: "Closed" } as const;

/** Today's registers for a teacher (every class for admins). Works from the phone's copy when offline. */
export function TodayRegisters({ schoolId, perPeriod, refreshKey }: { schoolId: string; perPeriod: boolean; refreshKey: number }) {
  const palette = usePalette();
  const sync = useSyncState();
  const [rows, setRows] = useState<TodayRow[] | null>(null);
  const [fromPhone, setFromPhone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await loadToday(schoolId);
      setRows(result.rows);
      setFromPhone(result.fromPhone);
      setError(null);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not load today's registers.");
    }
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey, sync.pending]);

  if (error && !rows) return <Message>{error}</Message>;
  if (!rows) return <Body muted>Loading today&apos;s registers...</Body>;

  if (rows.length === 0) {
    return (
      <Body muted>
        {perPeriod
          ? "You have no subjects to mark yet. An admin assigns subject teachers on the RollCol website."
          : "You are not the class teacher of any class yet. An admin chooses class teachers on the RollCol website."}
      </Body>
    );
  }

  return (
    <View style={styles.list}>
      {fromPhone ? <Message tone="warning">You are offline. Showing today&apos;s registers saved on this phone.</Message> : null}
      {sync.pending > 0 ? (
        <Message tone="accent">
          {sync.pending} {sync.pending === 1 ? "change is" : "changes are"} saved on this phone and will be sent when you are online.
        </Message>
      ) : null}
      {sync.error ? <Message>{sync.error}</Message> : null}

      {rows.map((row) => {
        const title = perPeriod ? `${row.class_name}, ${row.subject_name ?? "Subject"}` : row.class_name;
        const started = row.register_id !== null;
        const subtitle = started
          ? `${row.period_number ? `${periodLabel(row.period_number)} · ` : ""}${row.marked_count} of ${row.student_count} marked${
              row.status === "open" && row.closes_at ? ` · closes ${formatTime(row.closes_at)}` : ""
            }`
          : `${row.student_count} students · not started`;

        function open() {
          if (row.register_id) {
            router.push({ pathname: "/register/[id]", params: { id: row.register_id } });
          } else {
            router.push({
              pathname: "/register/start",
              params: {
                classId: row.class_id,
                className: row.class_name,
                classSubjectId: row.class_subject_id ?? "",
                subjectName: row.subject_name ?? "",
                periodsPerDay: String(row.periods_per_day),
              },
            });
          }
        }

        return (
          <Pressable
            key={`${row.class_id}-${row.class_subject_id ?? "daily"}-${row.register_id ?? "new"}`}
            accessibilityRole="button"
            onPress={open}
            disabled={!started && row.student_count === 0}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: palette.surface, borderColor: palette.line, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={styles.rowText}>
              <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
              <Text style={[styles.subtitle, { color: palette.muted }]}>{subtitle}</Text>
            </View>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: !started ? palette.accent : row.status === "open" ? palette.accentSoft : palette.surfaceMuted,
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: !started ? palette.accentText : row.status === "open" ? palette.accent : palette.muted }]}>
                {!started ? "Take" : row.status ? STATUS_LABEL[row.status] : "Open"}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 12, padding: 14 },
  rowText: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: "600" },
  subtitle: { fontSize: 13 },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  badgeText: { fontSize: 13, fontWeight: "600" },
});
