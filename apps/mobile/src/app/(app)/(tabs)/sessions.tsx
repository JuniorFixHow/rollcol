import { sessionState } from "@rollcol/shared";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Badge, Empty, PullHint, Row, SectionTitle, usePullHint } from "@/components/kit";
import { usePalette } from "@/components/theme";
import { Button, Message } from "@/components/ui";
import { formatDayTime } from "@/lib/format";
import { type MyRun, loadMyRuns } from "@/lib/runs";
import { useLecturerSessions } from "@/lib/sessions";
import { useSession } from "@/lib/session";

export default function SessionsScreen() {
  const { member } = useSession();
  const palette = usePalette();
  const hint = usePullHint();
  const schoolId = member && member.kind !== "none" ? member.school.id : "";
  const { sessions, reload } = useLecturerSessions(schoolId);
  const [runs, setRuns] = useState<MyRun[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadRuns = useCallback(async () => {
    if (!member || member.kind !== "staff") return;
    setRuns(await loadMyRuns(member.school.id, member.id, member.role === "admin"));
  }, [member]);

  useFocusEffect(
    useCallback(() => {
      void loadRuns();
    }, [loadRuns]),
  );

  if (!member || member.kind !== "staff") return null;
  const past = sessions.map((s) => ({ ...s, state: sessionState(s) })).filter((s) => s.state === "ended" || s.state === "void");

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
            await Promise.all([loadRuns(), reload()]);
            setRefreshing(false);
          }}
        />
      }
    >
      <PullHint show={hint.show} />
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button label="Start a session" onPress={() => router.push("/session/start")} />
        </View>
        <View style={styles.flex}>
          <Button label="Add a course" variant="secondary" onPress={() => router.push("/course/new")} />
        </View>
      </View>

      <SectionTitle>Your courses this semester</SectionTitle>
      {runs !== null && runs.length === 0 ? (
        <Empty icon="book-outline">No courses yet. Add a course you teach, or ask an admin to add you to one.</Empty>
      ) : null}
      {(runs ?? []).map((run) => (
        <Row
          key={run.id}
          title={`${run.course?.code ?? ""} · ${run.course?.title ?? ""}`}
          subtitle={`${run.enrolments[0]?.count ?? 0} students joined`}
          right={run.approved_at ? null : <Badge tone="warning">Waiting for approval</Badge>}
        />
      ))}
      {(runs ?? []).some((run) => !run.approved_at) ? (
        <Message tone="warning">An admin must approve new courses before students can join them and you can run sessions.</Message>
      ) : null}

      <SectionTitle>Past two weeks</SectionTitle>
      {past.length === 0 ? <Empty icon="time-outline">No sessions yet.</Empty> : null}
      {past.map((session) => (
        <Row
          key={session.id}
          title={`${session.course_run?.course?.code ?? ""} · ${formatDayTime(session.starts_at)}`}
          subtitle={`${session.session_checkins[0]?.count ?? 0} of ${session.course_run?.enrolments[0]?.count ?? 0} checked in · ${session.venue?.name ?? (session.radius_m ? "Lecturer's location" : "No location check")}`}
          right={session.state === "void" ? <Badge tone="danger">Cancelled</Badge> : null}
          onPress={() => router.push({ pathname: "/session/[id]", params: { id: session.id } })}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12 },
  actions: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
});
