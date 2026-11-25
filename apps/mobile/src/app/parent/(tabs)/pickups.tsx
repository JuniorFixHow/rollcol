import { type Database } from "@rollcol/shared";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { ConfirmDialog } from "@/components/dialog";
import { Badge, Empty } from "@/components/kit";
import { usePalette } from "@/components/theme";
import { Body, Button, Message } from "@/components/ui";
import { supabase } from "@/lib/supabase";

type Pickup = Database["public"]["Functions"]["parent_pickups"]["Returns"][number];

function shortDay(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${iso}T12:00:00Z`),
  );
}

const STATUS: Record<string, { label: string; tone: "accent" | "success" | "neutral" }> = {
  active: { label: "Ready", tone: "accent" },
  used: { label: "Collected", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  expired: { label: "Not used", tone: "neutral" },
};

/** All the parent's pickup codes, from the last week and ahead. */
export default function PickupsScreen() {
  const palette = usePalette();
  const [items, setItems] = useState<Pickup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancel, setCancel] = useState<Pickup | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase.rpc("parent_pickups", {});
    if (loadError) setError("We could not reach RollCol. Pull down to try again.");
    else {
      setError(null);
      setItems(data);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function confirmCancel() {
    if (!cancel) return;
    setBusy(true);
    const { error: cancelError } = await supabase.rpc("parent_cancel_pickup", { p_id: cancel.id });
    setBusy(false);
    setCancel(null);
    if (cancelError) setError("RollCol could not cancel this code. Please try again.");
    else void load();
  }

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
      <Body muted>
        If someone else collects your child, make a code and give it to them. The teacher asks for it before releasing your child. A code
        works once, on its day.
      </Body>
      <Button label="Make a pickup code" onPress={() => router.push("/parent/pickup")} />
      {error ? <Message>{error}</Message> : null}
      {items && items.length === 0 ? <Empty icon="key-outline">No pickup codes yet.</Empty> : null}
      {(items ?? []).map((p) => {
        const status = STATUS[p.status] ?? STATUS.expired;
        return (
          <View key={p.id} style={[styles.item, { backgroundColor: palette.surface, borderColor: palette.line }]}>
            <View style={styles.top}>
              <Text style={[styles.title, { color: palette.text }]}>
                {p.status === "active" ? <Text style={styles.code}>{p.code}  </Text> : null}
                {p.collector_name}
              </Text>
              {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
            </View>
            <Text style={{ color: palette.muted }}>
              {p.student_name} · {shortDay(p.pickup_date)}
              {p.released_by_name ? ` · released by ${p.released_by_name}` : ""}
            </Text>
            {p.status === "active" ? (
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() =>
                    void Share.share({
                      message: `RollCol pickup code for ${p.student_name}: ${p.code}. Give it to the teacher when you collect them (${shortDay(p.pickup_date)}).`,
                    })
                  }
                >
                  <Text style={[styles.action, { color: palette.accent }]}>Share</Text>
                </Pressable>
                <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setCancel(p)}>
                  <Text style={[styles.action, { color: palette.danger }]}>Cancel</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}
      <ConfirmDialog
        visible={cancel !== null}
        title={`Cancel the code for ${cancel?.collector_name ?? ""}?`}
        message="It will no longer work."
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
  content: { padding: 24, gap: 12 },
  item: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 6 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { flex: 1, fontSize: 16, fontWeight: "600" },
  code: { fontWeight: "800", letterSpacing: 2, fontVariant: ["tabular-nums"] },
  actions: { flexDirection: "row", gap: 20, marginTop: 4 },
  action: { fontSize: 14, fontWeight: "600" },
});
