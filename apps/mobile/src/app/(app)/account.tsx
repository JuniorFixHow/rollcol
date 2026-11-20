import { APPLE_STANDARD_EULA_URL } from "@rollcol/shared";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { Body, Button, Card, Message } from "@/components/ui";
import { useSession } from "@/lib/session";
import { WEB_URL, supabase } from "@/lib/supabase";

export default function AccountScreen() {
  const { member, session } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startDeletion() {
    setError(null);
    const { data: effect, error: effectError } = await supabase.rpc("account_deletion_effect");
    if (effectError) {
      setError("We could not reach RollCol. Check your connection and try again.");
      return;
    }
    if (effect === "last_admin") {
      setError("You are the only admin at your school. Make another staff member an admin on the RollCol website first.");
      return;
    }
    const schoolName = member && member.kind !== "none" ? member.school.name : "your school";
    const message =
      effect === "deletes_school"
        ? `You are the only staff member, so ${schoolName} and all its records will be deleted too. This cannot be undone.`
        : "Your RollCol account and the data tied to it will be deleted. This cannot be undone.";

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
      </Card>

      <View style={styles.group}>
        <Button label="Change password" variant="secondary" onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}/forgot-password`)} />
        <Button label="Privacy policy" variant="secondary" onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}/privacy`)} />
        <Button label="Terms of Use" variant="secondary" onPress={() => void WebBrowser.openBrowserAsync(APPLE_STANDARD_EULA_URL)} />
        <Button label="Sign out" variant="secondary" onPress={() => void supabase.auth.signOut()} />
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
});
