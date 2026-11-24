import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Badge, Empty, PullHint, usePullHint } from "@/components/kit";
import { usePalette } from "@/components/theme";
import { Message } from "@/components/ui";
import { formatDayTime } from "@/lib/format";
import { supabase } from "@/lib/supabase";

interface SchoolMessage {
  id: number;
  school_name: string;
  kind: string;
  body: string;
  sent_at: string;
}

const KIND_LABEL: Record<string, string> = {
  attendance: "Attendance",
  broadcast: "Announcement",
  custom: "Message",
  system: "Notice",
};

/** The SMS the schools sent to this number, newest first. */
export default function MessagesScreen() {
  const palette = usePalette();
  const [items, setItems] = useState<SchoolMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(true);
  const hint = usePullHint();

  const load = useCallback(async (before?: number) => {
    const { data, error: loadError } = await supabase.rpc("parent_messages", before ? { p_before: before, p_limit: 50 } : { p_limit: 50 });
    setLoaded(true);
    if (loadError) {
      setError("We could not reach RollCol. Check your connection and pull down to try again.");
      return;
    }
    setError(null);
    setMore(data.length === 50);
    setItems((current) => (before ? [...current, ...data] : data));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      data={items}
      keyExtractor={(item) => String(item.id)}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            hint.markPulled();
            setRefreshing(true);
            void load().finally(() => setRefreshing(false));
          }}
        />
      }
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        const last = items[items.length - 1];
        if (more && last) void load(last.id);
      }}
      ListHeaderComponent={
        <View style={styles.header}>
          <PullHint show={hint.show && items.length > 0} />
          {error ? <Message>{error}</Message> : null}
        </View>
      }
      ListEmptyComponent={
        loaded && !error ? (
          <Empty icon="chatbubbles-outline">
            No messages yet. The SMS your child&apos;s school sends you (alerts, announcements and messages) also appear here.
          </Empty>
        ) : undefined
      }
      renderItem={({ item }) => (
        <View style={[styles.item, { backgroundColor: palette.surface, borderColor: palette.line }]}>
          <View style={styles.itemTop}>
            <Text style={[styles.school, { color: palette.text }]} numberOfLines={1}>
              {item.school_name}
            </Text>
            <Badge tone={item.kind === "attendance" ? "accent" : "neutral"}>{KIND_LABEL[item.kind] ?? "Message"}</Badge>
          </View>
          <Text style={[styles.body, { color: palette.text }]}>{item.body}</Text>
          <Text style={[styles.time, { color: palette.muted }]}>{formatDayTime(item.sent_at)}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 12 },
  header: { gap: 12 },
  item: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 6 },
  itemTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  school: { flex: 1, fontSize: 14, fontWeight: "700" },
  body: { fontSize: 15, lineHeight: 21 },
  time: { fontSize: 12 },
});
