import { addDays, mondayOf, rangeLabel } from "@rollcol/shared";
import { Ionicons } from "@expo/vector-icons";
import { ABSENCE_REASONS, isAbsenceReason } from "@rollcol/shared";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { ConfirmDialog } from "@/components/dialog";
import { Badge, SectionTitle } from "@/components/kit";
import { usePalette } from "@/components/theme";
import { Body, Button, Card, Message } from "@/components/ui";
import { formatDay, ghanaDate } from "@/lib/format";
import { firstName, markLabel } from "@/lib/parent";
import { supabase } from "@/lib/supabase";

interface Pickup {
  id: string;
  code: string;
  pickup_date: string;
  collector_name: string;
  status: string;
}

interface Absence {
  id: string;
  from_date: string;
  to_date: string;
  reason: string;
  note: string | null;
}

function shortDay(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${iso}T12:00:00Z`),
  );
}

interface Day {
  day: string;
  mark: string | null;
}

/** A child's school days a week at a time, with arrows, Monday to Friday. */
export default function ChildAttendanceScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const palette = usePalette();
  const today = ghanaDate();
  const [week, setWeek] = useState(() => mondayOf(today));
  const [days, setDays] = useState<Day[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const friday = addDays(week, 4);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [cancel, setCancel] = useState<{ kind: "pickup" | "absence"; id: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadExtras = useCallback(async () => {
    const [p, a] = await Promise.all([
      supabase.rpc("parent_pickups", { p_student_id: id }),
      supabase
        .from("absence_reports")
        .select("id, from_date, to_date, reason, note")
        .eq("student_id", id)
        .eq("status", "active")
        .gte("to_date", today)
        .order("from_date"),
    ]);
    setPickups((p.data ?? []).filter((x) => x.status === "active" || x.pickup_date === today));
    setAbsences(a.data ?? []);
  }, [id, today]);

  useFocusEffect(
    useCallback(() => {
      void loadExtras();
    }, [loadExtras]),
  );

  async function confirmCancel() {
    if (!cancel) return;
    setBusy(true);
    const { error: cancelError } =
      cancel.kind === "pickup"
        ? await supabase.rpc("parent_cancel_pickup", { p_id: cancel.id })
        : await supabase.rpc("parent_cancel_absence", { p_id: cancel.id });
    setBusy(false);
    setCancel(null);
    if (cancelError) setError("RollCol could not cancel this. Please try again.");
    else void loadExtras();
  }

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase.rpc("parent_child_days", { p_student_id: id, p_from: week, p_to: friday });
    if (loadError) {
      setError(/cannot see/i.test(loadError.message) ? "This child is no longer linked to your account." : "We could not reach RollCol. Pull down to try again.");
      return;
    }
    setError(null);
    setDays(data);
  }, [id, week, friday]);

  useEffect(() => {
    void load();
  }, [load]);

  const byDay = new Map((days ?? []).map((d) => [d.day, d.mark]));
  const weekdays = [0, 1, 2, 3, 4].map((offset) => addDays(week, offset));
  const held = (days ?? []).length;
  const attended = (days ?? []).filter((d) => d.mark === "present" || d.mark === "late").length;
  const canGoForward = addDays(week, 7) <= today;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load().finally(() => setRefreshing(false));
          }}
        />
      }
    >
      <Stack.Screen options={{ title: name ? firstName(name) : "Attendance" }} />
      {name ? <Text style={[styles.name, { color: palette.text }]}>{name}</Text> : null}

      <View style={styles.weekBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous week" hitSlop={8} onPress={() => setWeek(addDays(week, -7))} style={styles.arrow}>
          <Ionicons name="chevron-back" size={22} color={palette.accent} />
        </Pressable>
        <Text style={[styles.weekLabel, { color: palette.text }]}>{rangeLabel(week, friday)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next week"
          accessibilityState={{ disabled: !canGoForward }}
          disabled={!canGoForward}
          hitSlop={8}
          onPress={() => setWeek(addDays(week, 7))}
          style={[styles.arrow, canGoForward ? null : { opacity: 0.3 }]}
        >
          <Ionicons name="chevron-forward" size={22} color={palette.accent} />
        </Pressable>
      </View>
      {week !== mondayOf(today) ? (
        <Pressable accessibilityRole="button" onPress={() => setWeek(mondayOf(today))}>
          <Text style={[styles.thisWeek, { color: palette.accent }]}>Back to this week</Text>
        </Pressable>
      ) : null}

      {error ? <Message>{error}</Message> : null}

      <View style={styles.group}>
        {weekdays.map((day) => {
          const future = day > today;
          const hasRegister = byDay.has(day);
          const label = future ? { label: "Coming up", tone: "neutral" as const } : markLabel(byDay.get(day) ?? null, hasRegister);
          return (
            <View key={day} style={[styles.dayRow, { backgroundColor: palette.surface, borderColor: palette.line }]}>
              <Text style={[styles.dayText, { color: palette.text }]}>
                {formatDay(`${day}T12:00:00Z`)}
                {day === today ? " (today)" : ""}
              </Text>
              <Badge tone={label.tone}>{label.label}</Badge>
            </View>
          );
        })}
      </View>

      {days ? (
        <Card>
          <SectionTitle>This week</SectionTitle>
          <Body>{held === 0 ? "No registers this week." : `Attendance ${attended} out of ${held}`}</Body>
        </Card>
      ) : null}
      <Body muted>A day counts as present if your child was present or late in any register that day.</Body>

      <View style={styles.group}>
        <SectionTitle>Pickup codes</SectionTitle>
        {pickups.map((p) => (
          <View key={p.id} style={[styles.dayRow, { backgroundColor: palette.surface, borderColor: palette.line }]}>
            <View style={styles.flex}>
              <Text style={[styles.dayText, { color: palette.text }]}>
                {p.status === "active" ? `${p.code} · ` : ""}
                {p.collector_name}
              </Text>
              <Text style={{ color: palette.muted }}>{shortDay(p.pickup_date)}</Text>
            </View>
            {p.status === "active" ? (
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setCancel({ kind: "pickup", id: p.id, title: `Cancel the code for ${p.collector_name}?` })}>
                <Text style={{ color: palette.danger, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
            ) : (
              <Badge tone={p.status === "used" ? "success" : "neutral"}>{p.status === "used" ? "Collected" : "Cancelled"}</Badge>
            )}
          </View>
        ))}
        <Button
          label="Make a pickup code"
          variant="secondary"
          onPress={() => router.push({ pathname: "/parent/pickup", params: { id, name: name ?? "" } })}
        />
      </View>

      <View style={styles.group}>
        <SectionTitle>Absences you reported</SectionTitle>
        {absences.map((a) => (
          <View key={a.id} style={[styles.dayRow, { backgroundColor: palette.surface, borderColor: palette.line }]}>
            <View style={styles.flex}>
              <Text style={[styles.dayText, { color: palette.text }]}>
                {a.from_date === a.to_date ? shortDay(a.from_date) : `${shortDay(a.from_date)} to ${shortDay(a.to_date)}`}
              </Text>
              <Text style={{ color: palette.muted }}>
                {isAbsenceReason(a.reason) ? ABSENCE_REASONS[a.reason] : a.reason}
                {a.note ? ` · ${a.note}` : ""}
              </Text>
            </View>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setCancel({ kind: "absence", id: a.id, title: "Cancel this absence report?" })}>
              <Text style={{ color: palette.danger, fontWeight: "600" }}>Cancel</Text>
            </Pressable>
          </View>
        ))}
        <Button
          label="Report an absence"
          variant="secondary"
          onPress={() => router.push({ pathname: "/parent/absence", params: { id, name: name ?? "" } })}
        />
      </View>

      <ConfirmDialog
        visible={cancel !== null}
        title={cancel?.title ?? ""}
        message={cancel?.kind === "pickup" ? "The code will no longer work." : "The school will expect your child again on these days."}
        confirmLabel="Cancel it"
        danger
        busy={busy}
        onCancel={() => setCancel(null)}
        onConfirm={() => void confirmCancel()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 16 },
  group: { gap: 8 },
  name: { fontSize: 20, fontWeight: "700" },
  weekBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  arrow: { padding: 6 },
  weekLabel: { fontSize: 16, fontWeight: "600" },
  thisWeek: { fontSize: 14, fontWeight: "600", textAlign: "center" },
  dayRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  dayText: { fontSize: 15, fontWeight: "500" },
  flex: { flex: 1 },
});
