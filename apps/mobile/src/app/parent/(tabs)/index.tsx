import { attendanceRate, schoolDayText } from "@rollcol/shared";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Badge, Empty, PullHint, SectionTitle, usePullHint } from "@/components/kit";
import { usePalette } from "@/components/theme";
import { Body, Button, Card, Loading, Message } from "@/components/ui";
import { type ParentChild, markLabel } from "@/lib/parent";
import { ghanaDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";

interface Status {
  active: number;
  pending: number;
  unlinked: number;
}

function ChildCard({ child, todayTimes }: { child: ParentChild; todayTimes: string | null }) {
  const palette = usePalette();
  if (!child.student_id || !child.full_name) {
    return (
      <Card>
        <Text style={[styles.name, { color: palette.text }]}>{child.school_name}</Text>
        <Body muted>Waiting for the school to confirm your link. You are told here as soon as it does.</Body>
      </Card>
    );
  }
  const today = markLabel(child.today_mark, child.today_held);
  const rate = attendanceRate(child.attended, child.held);
  const id = child.student_id;
  const name = child.full_name;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, today ${today.label}`}
      onPress={() => router.push({ pathname: "/parent/child/[id]", params: { id, name } })}
      style={({ pressed }) => [styles.card, { backgroundColor: palette.surface, borderColor: palette.line }, pressed ? { opacity: 0.7 } : null]}
    >
      <View style={styles.cardTop}>
        <View style={styles.flex}>
          <Text style={[styles.name, { color: palette.text }]}>{name}</Text>
          <Text style={[styles.meta, { color: palette.muted }]}>
            {child.class_name ? `${child.class_name} · ` : ""}
            {child.school_name}
          </Text>
          {todayTimes ? <Text style={[styles.meta, { color: palette.text }]}>Today: {todayTimes}</Text> : null}
        </View>
        <View style={styles.today}>
          <Text style={[styles.todayLabel, { color: palette.muted }]}>Today</Text>
          <Badge tone={today.tone}>{today.label}</Badge>
        </View>
      </View>
      <View style={[styles.term, { borderTopColor: palette.line }]}>
        {child.held > 0 ? (
          <>
            <Text style={[styles.termLine, { color: palette.text }]}>
              Attendance {child.attended} out of {child.held}
              {rate === null ? "" : ` (${rate}%)`}
            </Text>
            <Text style={[styles.meta, { color: palette.muted }]}>
              {child.period_name ?? "So far"}
              {child.absent > 0 ? ` · ${child.absent} absent` : ""}
              {child.late > 0 ? ` · ${child.late} late` : ""}
            </Text>
          </>
        ) : (
          <Text style={[styles.meta, { color: palette.muted }]}>No registers yet{child.period_name ? ` in ${child.period_name}` : ""}.</Text>
        )}
      </View>
    </Pressable>
  );
}

export default function ChildrenScreen() {
  const [children, setChildren] = useState<ParentChild[]>([]);
  const [todayTimes, setTodayTimes] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const hint = usePullHint();
  const palette = usePalette();

  const load = useCallback(async () => {
    const [statusResult, childrenResult] = await Promise.all([supabase.rpc("parent_status"), supabase.rpc("parent_children")]);
    if (statusResult.error || childrenResult.error) {
      setError("We could not reach RollCol. Check your connection and pull down to try again.");
      return;
    }
    setError(null);
    const first = statusResult.data[0];
    setStatus({ active: first?.active ?? 0, pending: first?.pending ?? 0, unlinked: first?.unlinked ?? 0 });
    setChildren(childrenResult.data);
    const today = ghanaDate();
    const entries = await Promise.all(
      childrenResult.data.flatMap((c) =>
        c.student_id
          ? [
              supabase
                .rpc("parent_school_days", { p_student_id: c.student_id, p_from: today, p_to: today })
                .then(({ data }) => [c.student_id ?? "", data?.[0] ? schoolDayText(data[0]) : ""] as const),
            ]
          : [],
      ),
    );
    setTodayTimes(Object.fromEntries(entries.filter(([, text]) => text)));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function refresh() {
    hint.markPulled();
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (!status && !error) return <Loading />;
  const nothingLinked = status !== null && status.active === 0 && status.pending === 0;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      <PullHint show={hint.show && !nothingLinked} />
      {error ? <Message>{error}</Message> : null}

      {nothingLinked && status.unlinked > 0 ? (
        <Card>
          <Text style={[styles.heading, { color: palette.text }]}>Welcome to RollCol</Text>
          <Body>Your number is on your child&apos;s school records. To see their attendance, type one of your child&apos;s names.</Body>
          <Button label="Add your child" onPress={() => router.push("/parent/link")} />
        </Card>
      ) : null}
      {nothingLinked && status.unlinked === 0 ? (
        <Empty icon="people-outline">
          No school in RollCol has your child with this number. Ask the school to add this number to your child&apos;s
          record, then pull down to check again.
        </Empty>
      ) : null}

      {children.length > 0 ? (
        <View style={styles.group}>
          <SectionTitle>Your children</SectionTitle>
          {children.map((child) => (
            <ChildCard
              key={child.student_id ?? `pending-${child.school_id}`}
              child={child}
              todayTimes={child.student_id ? (todayTimes[child.student_id] ?? null) : null}
            />
          ))}
        </View>
      ) : null}

      {!nothingLinked && status && status.unlinked > 0 ? (
        <Card>
          <Body>Another school also has your number. Add your child there with one of their names.</Body>
          <Button label="Add a child" variant="secondary" onPress={() => router.push("/parent/link")} />
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 20 },
  group: { gap: 12 },
  flex: { flex: 1 },
  heading: { fontSize: 18, fontWeight: "700" },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  cardTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  name: { fontSize: 17, fontWeight: "700" },
  meta: { fontSize: 14, marginTop: 2 },
  today: { alignItems: "flex-end", gap: 4 },
  todayLabel: { fontSize: 12, fontWeight: "600" },
  term: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  termLine: { fontSize: 15, fontWeight: "600" },
});
