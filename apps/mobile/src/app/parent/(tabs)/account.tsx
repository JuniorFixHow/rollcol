import { APPLE_STANDARD_EULA_URL, formatPhoneForDisplay } from "@rollcol/shared";
import { router, useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ConfirmDialog } from "@/components/dialog";
import { Badge, Row, SectionTitle } from "@/components/kit";
import { usePalette } from "@/components/theme";
import { Body, Button, Card, Message } from "@/components/ui";
import { type ThemeChoice, getTheme, setTheme } from "@/lib/appearance";
import { forgetThisPhonesPush } from "@/lib/push";
import { forgetActiveSchool, useSession } from "@/lib/session";
import { WEB_URL, supabase } from "@/lib/supabase";

interface Link {
  id: string;
  school_name: string;
  status: string;
  children: string[];
}

export default function ParentAccountScreen() {
  const { session } = useSession();
  const palette = usePalette();
  const [links, setLinks] = useState<Link[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [unlink, setUnlink] = useState<Link | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [theme, setThemeChoice] = useState<ThemeChoice>("system");
  const phone = session?.user.phone ? formatPhoneForDisplay(session.user.phone.startsWith("+") ? session.user.phone : `+${session.user.phone}`) : "";

  useEffect(() => {
    void getTheme().then(setThemeChoice);
  }, []);

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase.rpc("parent_my_links");
    if (loadError) {
      setError("We could not reach RollCol. Check your connection and try again.");
      return;
    }
    setLinks(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function removeLink(link: Link) {
    setBusy(true);
    const { error: removeError } = await supabase.rpc("parent_unlink", { p_link_id: link.id });
    setBusy(false);
    setUnlink(null);
    if (removeError) setError("RollCol could not remove this link. Please try again.");
    else void load();
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
        <Body>{phone}</Body>
        <Body muted>Parent account. You sign in with this number and a code sent by SMS.</Body>
      </Card>

      <View style={styles.group}>
        <SectionTitle>Schools</SectionTitle>
        {links.length === 0 ? <Body muted>No school is linked yet.</Body> : null}
        {links.map((link) => (
          <Row
            key={link.id}
            title={link.school_name}
            subtitle={link.status === "pending" ? "Waiting for the school to confirm" : link.children.join(", ")}
            right={
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${link.school_name}`} hitSlop={8} onPress={() => setUnlink(link)}>
                {link.status === "pending" ? <Badge tone="warning">Waiting</Badge> : <Text style={[styles.remove, { color: palette.danger }]}>Remove</Text>}
              </Pressable>
            }
          />
        ))}
        <Button label="Add a child" variant="secondary" onPress={() => router.push("/parent/link")} />
      </View>

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
                onPress={() => {
                  setThemeChoice(option);
                  void setTheme(option);
                }}
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
        <Button label="Privacy policy" variant="secondary" onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}/privacy`)} />
        <Button label="Terms of Use" variant="secondary" onPress={() => void WebBrowser.openBrowserAsync(APPLE_STANDARD_EULA_URL)} />
        <Button
          label="Sign out"
          variant="secondary"
          onPress={() => void forgetThisPhonesPush().then(() => supabase.auth.signOut({ scope: "local" }))}
        />
      </View>

      <View style={styles.group}>
        {error ? <Message>{error}</Message> : null}
        <Button label="Delete account" variant="danger" onPress={() => setConfirmDelete(true)} busy={busy} />
        <Body muted>Deleting your account removes your links to your children. The school keeps your number on its records.</Body>
      </View>

      <ConfirmDialog
        visible={unlink !== null}
        title={unlink?.status === "pending" ? "Cancel this link?" : `Remove ${unlink?.school_name ?? "this school"}?`}
        message={
          unlink?.status === "pending"
            ? "The school will not be asked to confirm it."
            : "You will no longer see these children in RollCol. You can add them again with one of their names."
        }
        confirmLabel="Remove"
        danger
        busy={busy}
        onCancel={() => setUnlink(null)}
        onConfirm={() => {
          if (unlink) void removeLink(unlink);
        }}
      />
      <ConfirmDialog
        visible={confirmDelete}
        title="Delete your account?"
        message="Your RollCol parent account and its links are removed. This cannot be undone. You can make a new account with your number later."
        confirmLabel="Delete"
        danger
        busy={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          void deleteAccount();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 24 },
  group: { gap: 12 },
  heading: { fontSize: 15, fontWeight: "600" },
  remove: { fontSize: 14, fontWeight: "600" },
  segments: { flexDirection: "row", borderWidth: 1, borderRadius: 10, padding: 3 },
  segment: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 8 },
  segmentText: { fontSize: 14, fontWeight: "600" },
});
