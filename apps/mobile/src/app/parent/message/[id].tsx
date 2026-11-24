import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ConfirmDialog } from "@/components/dialog";
import { Badge } from "@/components/kit";
import { usePalette } from "@/components/theme";
import { Button, Loading, Message } from "@/components/ui";
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
}

/** One message from a school, in full. */
export default function MessageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const palette = usePalette();
  const [item, setItem] = useState<SchoolMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.rpc("parent_messages", { p_id: Number(id), p_limit: 1 }).then(({ data, error: loadError }) => {
      if (loadError) setError("We could not reach RollCol. Check your connection and try again.");
      else if (!data[0]) setError("This message is no longer here.");
      else {
        setItem(data[0]);
        void supabase.rpc("mark_messages_read", { p_sms_id: Number(id) }).then(() => refreshUnreadBadge());
      }
    });
  }, [id]);

  async function remove() {
    setBusy(true);
    const { error: deleteError } = await supabase.rpc("parent_delete_messages", { p_ids: [Number(id)] });
    setBusy(false);
    setConfirm(false);
    if (deleteError) setError("RollCol could not delete this message. Please try again.");
    else router.back();
  }

  if (!item && !error) return <Loading />;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      {error ? <Message>{error}</Message> : null}
      {item ? (
        <>
          <View style={styles.top}>
            <Text style={[styles.school, { color: palette.text }]}>{item.school_name}</Text>
            <Badge tone={item.kind === "attendance" ? "accent" : "neutral"}>{KIND_LABEL[item.kind] ?? "Message"}</Badge>
          </View>
          <Text style={[styles.time, { color: palette.muted }]}>{formatDayTime(item.sent_at)}</Text>
          <Text selectable style={[styles.body, { color: palette.text }]}>
            {item.body}
          </Text>
          <Button label="Delete" variant="secondary" onPress={() => setConfirm(true)} />
        </>
      ) : null}
      <ConfirmDialog
        visible={confirm}
        title="Delete this message?"
        message="It is removed from your Messages. The school keeps its own record."
        confirmLabel="Delete"
        danger
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void remove()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 12 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  school: { flex: 1, fontSize: 17, fontWeight: "700" },
  time: { fontSize: 13 },
  body: { fontSize: 16, lineHeight: 24, marginVertical: 8 },
});
