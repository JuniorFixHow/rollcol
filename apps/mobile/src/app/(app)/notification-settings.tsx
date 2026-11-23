import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { AppState, Linking, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { usePalette } from "@/components/theme";
import { Body, Button, Card, Message } from "@/components/ui";
import { type PushPermission, pushPermission, registerForPush, registerStaffPush } from "@/lib/push";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

type Kind = "sessions" | "reminders" | "moves";

const KINDS: { kind: Kind; title: string; detail: string; for: "student" | "staff" }[] = [
  {
    kind: "sessions",
    title: "Classes",
    detail: "A class opening or being cancelled, and changes to your check-in (for example marked present by a lecturer).",
    for: "student",
  },
  {
    kind: "reminders",
    title: "Check-in reminders",
    detail: "5 minutes before check-in closes, if you have not checked in.",
    for: "student",
  },
  {
    kind: "moves",
    title: "Workspace moves",
    detail: "Someone asks to move a workspace into your school, or your own request is approved or declined.",
    for: "staff",
  },
];

/**
 * Which notifications this person gets. Security notices (a new phone signing
 * in to the account) are always sent and cannot be turned off.
 */
export default function NotificationSettingsScreen() {
  const { member } = useSession();
  const palette = usePalette();
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [enabled, setEnabled] = useState<Record<Kind, boolean>>({ sessions: true, reminders: true, moves: true });
  const [saving, setSaving] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isStudent = member?.kind === "student";

  const load = useCallback(async () => {
    setPermission(await pushPermission());
    const { data } = await supabase.from("notification_settings").select("kind, enabled");
    setEnabled((current) => {
      const next = { ...current };
      for (const row of data ?? []) if (row.kind === "sessions" || row.kind === "reminders" || row.kind === "moves") next[row.kind] = row.enabled;
      return next;
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      // Coming back from the phone's Settings app.
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") void load();
      });
      return () => subscription.remove();
    }, [load]),
  );

  async function turnOn() {
    const ok = isStudent ? await registerForPush() : await registerStaffPush();
    setPermission(await pushPermission());
    if (!ok && (await pushPermission()) === "denied") setError("Notifications are off for RollCol in your phone's settings.");
  }

  async function toggle(kind: Kind, value: boolean) {
    setError(null);
    setSaving(kind);
    setEnabled((current) => ({ ...current, [kind]: value }));
    const { error: saveError } = await supabase.rpc("set_notification_setting", { p_kind: kind, p_enabled: value });
    setSaving(null);
    if (saveError) {
      setEnabled((current) => ({ ...current, [kind]: !value }));
      setError("RollCol could not save this. Check your connection and try again.");
    }
  }

  const kinds = KINDS.filter((k) => (isStudent ? k.for === "student" : k.for === "staff"));

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      {permission === "denied" ? (
        <Card>
          <Text style={[styles.title, { color: palette.text }]}>Notifications are off</Text>
          <Body muted>Your phone does not let RollCol show notifications. Turn them on for RollCol in Settings, then come back.</Body>
          <Button label="Open Settings" variant="secondary" onPress={() => void Linking.openSettings()} />
        </Card>
      ) : permission === "undetermined" ? (
        <Card>
          <Text style={[styles.title, { color: palette.text }]}>Get notifications on this phone</Text>
          <Body muted>Your phone will ask once whether RollCol may show notifications.</Body>
          <Button label="Turn on notifications" onPress={() => void turnOn()} />
        </Card>
      ) : permission === "unavailable" ? (
        <Message tone="warning">Notifications only work on a real phone, not in a simulator.</Message>
      ) : null}

      {error ? <Message>{error}</Message> : null}

      <View style={[styles.list, { borderColor: palette.line, backgroundColor: palette.surface }]}>
        {kinds.map((k, index) => (
          <View
            key={k.kind}
            style={[styles.row, index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.line } : null]}
          >
            <View style={styles.flex}>
              <Text style={[styles.rowTitle, { color: palette.text }]}>{k.title}</Text>
              <Text style={{ color: palette.muted }}>{k.detail}</Text>
            </View>
            <Switch
              value={enabled[k.kind]}
              disabled={saving === k.kind}
              onValueChange={(value) => void toggle(k.kind, value)}
              trackColor={{ true: palette.accent, false: palette.line }}
              accessibilityLabel={k.title}
            />
          </View>
        ))}
      </View>

      <Body muted>
        Security notices, such as your account signing in on a new phone, are always sent. Turned-off notifications still
        appear in the Notifications tab.
      </Body>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14 },
  title: { fontSize: 17, fontWeight: "700" },
  list: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  flex: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: "600" },
});
