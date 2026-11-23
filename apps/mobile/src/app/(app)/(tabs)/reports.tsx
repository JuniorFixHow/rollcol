import type { Database } from "@rollcol/shared";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Badge, Empty, PullHint, Row, SectionTitle, usePullHint } from "@/components/kit";
import { usePalette } from "@/components/theme";
import { Body, Message } from "@/components/ui";
import { type Period, currentPeriod, lowAttendancePercent } from "@/lib/reports";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

type OverviewRow = Database["public"]["Functions"]["attendance_overview"]["Returns"][number];

export default function ReportsScreen() {
  const { member } = useSession();
  const palette = usePalette();
  const hint = usePullHint();
  const [period, setPeriod] = useState<Period | null>(null);
  const [rows, setRows] = useState<OverviewRow[] | null>(null);
  const [threshold, setThreshold] = useState(75);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!member || member.kind !== "staff") return;
    const [found, percent] = await Promise.all([currentPeriod(member.school.id), lowAttendancePercent(member.school.id)]);
    setPeriod(found);
    setThreshold(percent);
    if (!found) return setRows([]);
    const { data, error } = await supabase.rpc("attendance_overview", { p_school_id: member.school.id, p_period_id: found.id });
    setFailed(Boolean(error));
    if (!error) setRows(data ?? []);
  }, [member]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!member || member.kind !== "staff") return null;
  const tertiary = member.school.type === "tertiary";

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={palette.accent}
          onRefresh={async () => {
            hint.markPulled();
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      <PullHint show={hint.show} />
      {failed ? <Message tone="warning">RollCol could not load your reports. Pull down to try again.</Message> : null}
      <SectionTitle>{period ? period.name : tertiary ? "Semester" : "Term"}</SectionTitle>
      <Body muted>
        {tertiary
          ? "Attendance for each of your courses. Tap one to see every student and share it."
          : "Attendance for each of your classes, counted by school days. Tap one for each pupil's \"Attendance X out of Y\"."}
      </Body>
      {rows === null ? null : !period ? (
        <Empty icon="calendar-outline">Your school has not added a {tertiary ? "semester" : "term"} yet.</Empty>
      ) : rows.length === 0 ? (
        <Empty icon="bar-chart-outline">{tertiary ? "You have no courses this semester." : "You do not teach any classes."}</Empty>
      ) : (
        <View style={styles.list}>
          {rows.map((row) => (
            <Row
              key={row.id}
              title={row.name}
              subtitle={[
                row.detail,
                `${row.students} students · ${row.held} ${tertiary ? "sessions" : "school days"}`,
                row.below > 0 ? `${row.below} below ${threshold}%` : null,
              ]
                .filter(Boolean)
                .join("\n")}
              right={
                row.rate === null ? (
                  <Badge>No data</Badge>
                ) : (
                  <Badge tone={row.rate < threshold ? "danger" : row.rate < threshold + 10 ? "warning" : "success"}>{`${row.rate}%`}</Badge>
                )
              }
              onPress={() =>
                router.push({
                  pathname: "/report/[kind]/[id]",
                  params: {
                    kind: row.kind,
                    id: row.id,
                    title: row.name,
                    periodName: period.name,
                    periodStart: period.startsOn,
                    periodEnd: period.endsOn,
                  },
                })
              }
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12 },
  list: { gap: 10 },
});
