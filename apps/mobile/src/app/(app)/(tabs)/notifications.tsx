import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { ConfirmDialog } from "@/components/dialog";
import { Empty, PullHint, usePullHint } from "@/components/kit";
import { usePalette } from "@/components/theme";
import { Body, Message } from "@/components/ui";
import { formatDayTime } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { refreshUnreadBadge } from "@/lib/unread";

interface Item {
  id: number;
  title: string;
  body: string;
  data: unknown;
  created_at: string;
  read_at: string | null;
}

function sessionIdOf(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const value = (data as Record<string, unknown>).sessionId;
  return typeof value === "string" ? value : null;
}

export default function NotificationsScreen() {
  const palette = usePalette();
  const hint = usePullHint();
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("push_outbox")
      .select("id, title, body, data, created_at, read_at")
      .order("created_at", { ascending: false })
      .limit(100);
    setLoaded(true);
    setFailed(Boolean(error));
    if (error) return;
    setItems(data ?? []);
    // Seen: clear the unread badge (they stay in the list until swiped away).
    if ((data ?? []).some((item) => item.read_at === null)) {
      await supabase.rpc("mark_notifications_read", { p_ids: null });
      refreshUnreadBadge();
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function dismiss(ids: number[] | null) {
    setItems((current) => (ids === null ? [] : current.filter((item) => !ids.includes(item.id))));
    await supabase.rpc("dismiss_notifications", { p_ids: ids });
    refreshUnreadBadge();
  }

  return (
    <>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
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
        ListHeaderComponent={
          <View style={styles.header}>
            <PullHint show={hint.show} />
            {failed ? <Message tone="warning">RollCol could not load your notifications. Pull down to try again.</Message> : null}
            {items.length > 0 ? (
              <View style={styles.headerRow}>
                <Body muted>Swipe left on a notification to remove it.</Body>
                <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setConfirmClear(true)}>
                  <Text style={[styles.clear, { color: palette.accent }]}>Clear all</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loaded ? (
            <Empty icon="notifications-outline">
              No notifications. You are told here when a class opens, is about to close, and whether you were marked present.
            </Empty>
          ) : undefined
        }
        renderItem={({ item }) => (
          <Swipeable
            friction={2}
            rightThreshold={60}
            overshootRight={false}
            onSwipeableOpen={() => void dismiss([item.id])}
            renderRightActions={() => (
              <View style={[styles.delete, { backgroundColor: palette.danger }]}>
                <Ionicons name="trash-outline" size={22} color="#ffffff" />
                <Text style={styles.deleteText}>Remove</Text>
              </View>
            )}
          >
            <Pressable
              onPress={() => {
                if (sessionIdOf(item.data)) router.navigate("/");
              }}
              style={[styles.item, { backgroundColor: palette.surface, borderColor: palette.line }]}
            >
              {item.read_at === null ? <View style={[styles.dot, { backgroundColor: palette.accent }]} /> : null}
              <View style={styles.flex}>
                <Text style={[styles.title, { color: palette.text }]}>{item.title}</Text>
                <Text style={[styles.body, { color: palette.text }]}>{item.body}</Text>
                <Text style={[styles.time, { color: palette.muted }]}>{formatDayTime(item.created_at)}</Text>
              </View>
            </Pressable>
          </Swipeable>
        )}
      />
      <ConfirmDialog
        visible={confirmClear}
        title="Clear all notifications?"
        message="They are removed from this list. Your attendance is not affected."
        confirmLabel="Clear all"
        danger
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          void dismiss(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 10 },
  header: { gap: 10, marginBottom: 2 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  clear: { fontSize: 15, fontWeight: "600" },
  item: { flexDirection: "row", gap: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  flex: { flex: 1, gap: 3 },
  title: { fontSize: 16, fontWeight: "600" },
  body: { fontSize: 15, lineHeight: 21 },
  time: { fontSize: 13, marginTop: 2 },
  delete: { width: 110, borderRadius: 12, marginLeft: 8, alignItems: "center", justifyContent: "center", gap: 4 },
  deleteText: { color: "#ffffff", fontSize: 13, fontWeight: "600" },
});
