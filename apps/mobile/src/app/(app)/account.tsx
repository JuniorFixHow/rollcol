import { APPLE_STANDARD_EULA_URL } from "@rollcol/shared";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { usePalette } from "@/components/theme";
import { type ThemeChoice, getTheme, setTheme } from "@/lib/appearance";
import { Body, Button, Card, Message } from "@/components/ui";
import { forgetActiveSchool, useSession } from "@/lib/session";
import { WEB_URL, supabase } from "@/lib/supabase";

export default function AccountScreen() {
  const { member, session } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setThemeChoice] = useState<ThemeChoice>("system");
  const palette = usePalette();

  useEffect(() => {
    void getTheme().then(setThemeChoice);
  }, []);

  function chooseTheme(choice: ThemeChoice) {
    setThemeChoice(choice);
    void setTheme(choice);
  }

  async function startDeletion() {
    setError(null);
    const { data: effects, error: effectError } = await supabase.rpc("account_deletion_effects");
    if (effectError) {
      setError("We could not reach RollCol. Check your connection and try again.");
      return;
    }
    const blocked = effects.filter((e) => e.effect === "last_admin").map((e) => e.school_name);
    if (blocked.length > 0) {
      setError(
        `You are the only admin at ${blocked.join(", ")}. Make another staff member an admin on the RollCol website first.`,
      );
      return;
    }
    const deleted = effects.filter((e) => e.effect === "deletes_school").map((e) => e.school_name);
    const message =
      deleted.length > 0
        ? `You are the only staff member at ${deleted.join(", ")}, so ${deleted.length === 1 ? "that school and all its records" : "those schools and all their records"} will be deleted too. This cannot be undone.`
        : "Your RollCol account will be removed from every school, with the data tied to it. This cannot be undone.";

    Alert.alert("Delete your account?", message, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void deleteAccount() },
    ]);
  }

  async function deleteAccount() {
    setBusy(true);
    const { error: fnError } = await supabase.functions.invoke("delete-account", { method: "POST" });
    if (fnError) {
      setBusy(false);
      setError("We could not delete your account. Please try again.");
      return;
    }
    await forgetActiveSchool();
    await supabase.auth.signOut({ scope: "local" });
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Card>
        <Body>{member && member.kind !== "none" ? member.fullName : ""}</Body>
        <Body muted>{session?.user.email}</Body>
        {member && member.kind !== "none" ? (
          <Body muted>
            {member.school.name} · School code {member.school.code} · School ID {member.schoolNumber}
          </Body>
        ) : null}
        {member && member.kind !== "none" ? (
          <Body muted>One email and password work for all your schools.</Body>
        ) : null}
      </Card>

      <View style={styles.group}>
        <Text style={[styles.heading, { color: palette.text }]}>Appearance</Text>
        <View accessibilityRole="radiogroup" style={[styles.segments, { borderColor: palette.line, backgroundColor: palette.surface }]}>
          {(["system", "light", "dark"] as const).map((option) => {
            const selected = theme === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => chooseTheme(option)}
                style={[styles.segment, selected ? { backgroundColor: palette.accentSoft } : null]}
              >
                <Text style={[styles.segmentText, { color: selected ? palette.accent : palette.muted }]}>
                  {option === "system" ? "Automatic" : option === "light" ? "Light" : "Dark"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.group}>
        <Button label="Change password" variant="secondary" onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}/forgot-password`)} />
        <Button label="Privacy policy" variant="secondary" onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}/privacy`)} />
        <Button label="Terms of Use" variant="secondary" onPress={() => void WebBrowser.openBrowserAsync(APPLE_STANDARD_EULA_URL)} />
        <Button label="Sign out" variant="secondary" onPress={() => void forgetActiveSchool().then(() => supabase.auth.signOut())} />
      </View>

      <View style={styles.group}>
        {error ? <Message>{error}</Message> : null}
        <Button label="Delete account" variant="danger" onPress={() => void startDeletion()} busy={busy} />
        <Body muted>Deleting your account removes your RollCol data. If your school also uses Stediis, your Stediis account is not affected.</Body>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 24 },
  group: { gap: 12 },
  heading: { fontSize: 15, fontWeight: "600" },
  segments: { flexDirection: "row", borderWidth: 1, borderRadius: 10, padding: 3 },
  segment: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 8 },
  segmentText: { fontSize: 14, fontWeight: "600" },
});
