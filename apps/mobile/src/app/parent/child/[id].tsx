import { addDays, mondayOf, rangeLabel, schoolDayText } from "@rollcol/shared";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Badge, SectionTitle } from "@/components/kit";
import { usePalette } from "@/components/theme";
import { Body, Card, Message } from "@/components/ui";
import { formatDay, ghanaDate } from "@/lib/format";
import { firstName, markLabel } from "@/lib/parent";
import { supabase } from "@/lib/supabase";

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
  const [times, setTimes] = useState<Record<string, { text: string; changed: boolean }>>({});
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const friday = addDays(week, 4);
  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase.rpc("parent_child_days", { p_student_id: id, p_from: week, p_to: friday });
    if (loadError) {
      setError(/cannot see/i.test(loadError.message) ? "This child is no longer linked to your account." : "We could not reach RollCol. Pull down to try again.");
      return;
    }
    setError(null);
    setDays(data);
    const { data: dayTimes } = await supabase.rpc("parent_school_days", { p_student_id: id, p_from: week, p_to: friday });
    setTimes(Object.fromEntries((dayTimes ?? []).map((t) => [t.day, { text: schoolDayText(t), changed: t.changed }])));
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
              <View style={styles.dayInfo}>
                <Text style={[styles.dayText, { color: palette.text }]}>
                  {formatDay(`${day}T12:00:00Z`)}
                  {day === today ? " (today)" : ""}
                </Text>
                {times[day] ? (
                  <Text style={[styles.times, { color: times[day].changed ? palette.warning : palette.muted }]}>
                    {times[day].changed && !times[day].text.startsWith("School closed") ? "Changed: " : ""}
                    {times[day].text}
                  </Text>
                ) : null}
              </View>
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
  dayInfo: { flex: 1, gap: 2, paddingRight: 8 },
  times: { fontSize: 13 },
});
