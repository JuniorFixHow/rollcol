import { APPLE_STANDARD_EULA_URL, formatPhoneForDisplay } from "@rollcol/shared";
import { router, useFocusEffect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ConfirmDialog } from "@/components/dialog";
import { Badge } from "@/components/kit";
import { ProfileHeader, SettingsGroup, SettingsRow, ThemeChooser } from "@/components/settings";
import { usePalette } from "@/components/theme";
import { Message } from "@/components/ui";
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

  const open = (url: string) => void WebBrowser.openBrowserAsync(url);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <ProfileHeader name={phone} lines={["Parent account", "You sign in with this number and a code sent by SMS."]} icon="call" />

      <SettingsGroup
        title="Your children's schools"
        footer="Removing a school stops you seeing those children here. You can add them again with one of their names."
      >
        {links.map((link) => (
          <SettingsRow
            key={link.id}
            icon="school-outline"
            title={link.school_name}
            subtitle={link.status === "pending" ? "Waiting for the school to confirm" : link.children.join(", ")}
            right={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${link.status === "pending" ? "Cancel" : "Remove"} ${link.school_name}`}
                hitSlop={10}
                onPress={() => setUnlink(link)}
              >
                {link.status === "pending" ? (
                  <Badge tone="warning">Waiting</Badge>
                ) : (
                  <Text style={[styles.remove, { color: palette.danger }]}>Remove</Text>
                )}
              </Pressable>
            }
          />
        ))}
        <SettingsRow icon="add" title="Add a child" onPress={() => router.push("/parent/link")} />
      </SettingsGroup>

      <SettingsGroup title="Preferences">
        <SettingsRow
          icon="notifications-outline"
          title="Notifications"
          subtitle="Absent and late, in school, and school messages"
          onPress={() => router.push("/parent/notification-settings")}
        />
        <View>
          <SettingsRow icon="contrast-outline" title="Appearance" />
          <ThemeChooser
            value={theme}
            onChange={(option) => {
              setThemeChoice(option);
              void setTheme(option);
            }}
            options={[
              { value: "system", label: "Automatic" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </View>
      </SettingsGroup>

      <SettingsGroup title="About">
        <SettingsRow icon="shield-checkmark-outline" title="Privacy policy" external onPress={() => open(`${WEB_URL}/privacy`)} />
        <SettingsRow icon="document-text-outline" title="Terms of Use" external onPress={() => open(APPLE_STANDARD_EULA_URL)} />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow
          icon="log-out-outline"
          title="Sign out"
          onPress={() => void forgetThisPhonesPush().then(() => supabase.auth.signOut({ scope: "local" }))}
        />
      </SettingsGroup>

      {error ? <Message>{error}</Message> : null}
      <SettingsGroup footer="Deleting your account removes your links to your children. The school keeps your number on its records.">
        <SettingsRow icon="trash-outline" title="Delete account" danger busy={busy} onPress={() => setConfirmDelete(true)} />
      </SettingsGroup>

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
  content: { padding: 20, gap: 24, paddingBottom: 40 },
  remove: { fontSize: 14, fontWeight: "600" },
});
