import { ABSENCE_REASONS, isAbsenceReason } from "@rollcol/shared";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { ConfirmDialog } from "@/components/dialog";
import { Empty } from "@/components/kit";
import { usePalette } from "@/components/theme";
import { Body, Button, Message } from "@/components/ui";
import { ghanaDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { useChildChoices } from "@/lib/use-children";

interface Absence {
  id: string;
  student_id: string;
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

/** Absences the parent reported, today and ahead. */
export default function AbsencesScreen() {
  const palette = usePalette();
  const children = useChildChoices();
  const [items, setItems] = useState<Absence[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancel, setCancel] = useState<Absence | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from("absence_reports")
      .select("id, student_id, from_date, to_date, reason, note")
      .eq("status", "active")
      .gte("to_date", ghanaDate())
      .order("from_date");
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
    const { error: cancelError } = await supabase.rpc("parent_cancel_absence", { p_id: cancel.id });
    setBusy(false);
    setCancel(null);
    if (cancelError) setError("RollCol could not cancel this report. Please try again.");
    else void load();
  }

  const nameOf = (id: string) => children.find((c) => c.value === id)?.label ?? "Your child";

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
        Tell the school ahead if your child will be absent. The class teacher is told, your child starts as absent on the register, and
        you get no absence alert for those days.
      </Body>
      <Button label="Report an absence" onPress={() => router.push("/parent/absence")} />
      {error ? <Message>{error}</Message> : null}
      {items && items.length === 0 ? <Empty icon="calendar-outline">No absences reported.</Empty> : null}
      {(items ?? []).map((a) => (
        <View key={a.id} style={[styles.item, { backgroundColor: palette.surface, borderColor: palette.line }]}>
          <Text style={[styles.title, { color: palette.text }]}>
            {nameOf(a.student_id)} · {a.from_date === a.to_date ? shortDay(a.from_date) : `${shortDay(a.from_date)} to ${shortDay(a.to_date)}`}
          </Text>
          <Text style={{ color: palette.muted }}>
            {isAbsenceReason(a.reason) ? ABSENCE_REASONS[a.reason] : a.reason}
            {a.note ? ` · ${a.note}` : ""}
          </Text>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setCancel(a)} style={styles.cancel}>
            <Text style={[styles.action, { color: palette.danger }]}>Cancel</Text>
          </Pressable>
        </View>
      ))}
      <ConfirmDialog
        visible={cancel !== null}
        title="Cancel this absence report?"
        message="The school will expect your child again on these days."
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
  title: { fontSize: 16, fontWeight: "600" },
  cancel: { alignSelf: "flex-start", marginTop: 4 },
  action: { fontSize: 14, fontWeight: "600" },
});
