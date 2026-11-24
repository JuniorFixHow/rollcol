import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { ConfirmDialog } from "@/components/dialog";
import { Badge, Empty, PullHint, usePullHint } from "@/components/kit";
import { usePalette } from "@/components/theme";
import { Message } from "@/components/ui";
import { formatDayTime } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { refreshUnreadBadge } from "@/lib/unread";
import { KIND_LABEL } from "@/lib/parent";

interface SchoolMessage {
  id: number;
  school_name: string;
  kind: string;
  body: string;
  sent_at: string;
  unread: boolean;
}


/** The SMS the schools sent to this number, newest first. */
export default function MessagesScreen() {
  const palette = usePalette();
  const [items, setItems] = useState<SchoolMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(true);
  const hint = usePullHint();
  const [confirmAll, setConfirmAll] = useState(false);
  const [busy, setBusy] = useState(false);

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
      // Opening Messages clears its unread count; the dots show until the next visit.
      void load().then(() => supabase.rpc("mark_messages_read", {}).then(() => refreshUnreadBadge()));
    }, [load]),
  );

  async function deleteAll() {
    setBusy(true);
    const { error: deleteError } = await supabase.rpc("parent_delete_messages", {});
    setBusy(false);
    setConfirmAll(false);
    if (deleteError) setError("RollCol could not delete your messages. Please try again.");
    else setItems([]);
  }

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
          {items.length > 0 ? (
            <Pressable accessibilityRole="button" onPress={() => setConfirmAll(true)} hitSlop={8} style={styles.deleteAll}>
              <Text style={[styles.deleteAllText, { color: palette.danger }]}>Delete all</Text>
            </Pressable>
          ) : null}
          <ConfirmDialog
            visible={confirmAll}
            title="Delete all messages?"
            message="They are removed from your Messages. The school keeps its own record."
            confirmLabel="Delete all"
            danger
            busy={busy}
            onCancel={() => setConfirmAll(false)}
            onConfirm={() => void deleteAll()}
          />
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
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Opens the whole message"
          onPress={() => router.push({ pathname: "/parent/message/[id]", params: { id: String(item.id) } })}
          style={({ pressed }) => [
            styles.item,
            { backgroundColor: palette.surface, borderColor: palette.line },
            pressed ? { opacity: 0.7 } : null,
          ]}
        >
          <View style={styles.itemTop}>
            {item.unread ? <View style={[styles.dot, { backgroundColor: palette.accent }]} accessibilityLabel="New" /> : null}
            <Text style={[styles.school, { color: palette.text }]} numberOfLines={1}>
              {item.school_name}
            </Text>
            <Badge tone={item.kind === "attendance" ? "accent" : "neutral"}>{KIND_LABEL[item.kind] ?? "Message"}</Badge>
          </View>
          <Text style={[styles.body, { color: palette.text }]} numberOfLines={3}>
            {item.body}
          </Text>
          <Text style={[styles.time, { color: palette.muted }]}>{formatDayTime(item.sent_at)}</Text>
        </Pressable>
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
  dot: { width: 8, height: 8, borderRadius: 4 },
  deleteAll: { alignSelf: "flex-end" },
  deleteAllText: { fontSize: 14, fontWeight: "600" },
});
