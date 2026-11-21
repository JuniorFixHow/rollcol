import type { Database } from "@rollcol/shared";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Badge, Empty } from "@/components/kit";
import { usePalette } from "@/components/theme";
import { Card, Message } from "@/components/ui";
import { formatDay, formatTime } from "@/lib/format";
import { supabase } from "@/lib/supabase";

type Item = Database["public"]["Functions"]["my_course_sessions"]["Returns"][number];

export default function CourseScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const palette = usePalette();
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("my_course_sessions", { p_course_run_id: id });
    setLoaded(true);
    setFailed(Boolean(error));
    if (!error) setItems(data ?? []);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const counted = items.filter((item) => !item.voided && new Date(item.ends_at).getTime() <= Date.now());
  const attended = counted.filter((item) => item.checked_in_at !== null);
  const marks = attended.reduce((sum, item) => sum + Number(item.reward_marks), 0);

  return (
    <>
      <Stack.Screen options={{ title: title ?? "Course" }} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.session_id}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
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
            {failed ? <Message tone="warning">RollCol could not load this course. Pull down to try again.</Message> : null}
            <Card>
              <Text style={[styles.big, { color: palette.text }]}>
                {attended.length} of {counted.length}
              </Text>
              <Text style={{ color: palette.muted }}>
                classes attended
                {counted.length > 0 ? ` (${Math.round((attended.length / counted.length) * 100)}%)` : ""}
                {marks > 0 ? ` · ${marks} marks` : ""}
              </Text>
            </Card>
          </View>
        }
        ListEmptyComponent={loaded ? <Empty icon="calendar-outline">No classes yet.</Empty> : undefined}
        renderItem={({ item }) => {
          const ended = new Date(item.ends_at).getTime() <= Date.now();
          return (
            <View style={[styles.row, { backgroundColor: palette.surface, borderColor: palette.line }]}>
              <View style={styles.flex}>
                <Text style={[styles.rowTitle, { color: palette.text }]}>{formatDay(item.starts_at)}</Text>
                <Text style={{ color: palette.muted }}>
                  {formatTime(item.starts_at)} to {formatTime(item.ends_at)}
                  {item.method === "manual" ? " · added by your lecturer" : ""}
                </Text>
              </View>
              {item.voided ? (
                <Badge>Cancelled</Badge>
              ) : item.checked_in_at ? (
                <Badge tone="success">{item.reward_marks > 0 ? `Present · ${item.reward_marks}` : "Present"}</Badge>
              ) : ended ? (
                <Badge tone="danger">Missed</Badge>
              ) : (
                <Badge tone="accent">Open</Badge>
              )}
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
  big: { fontSize: 32, fontWeight: "700" },
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14 },
  rowTitle: { fontSize: 16, fontWeight: "600" },
});
