import { APPLE_STANDARD_EULA_URL } from "@rollcol/shared";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { ConfirmDialog } from "@/components/dialog";
import { ProfileHeader, SettingsGroup, SettingsRow, ThemeChooser } from "@/components/settings";
import { formatDayTime } from "@/lib/format";
import { usePhone } from "@/lib/phone";
import { forgetThisPhonesPush } from "@/lib/push";
import { type ThemeChoice, getTheme, setTheme } from "@/lib/appearance";
import { Message } from "@/components/ui";
import { forgetActiveSchool, useSession } from "@/lib/session";
import { WEB_URL, supabase } from "@/lib/supabase";

export default function AccountScreen() {
  const { member, session, memberships } = useSession();
  const { phone } = usePhone();
  const [confirm, setConfirm] = useState<{ message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setThemeChoice] = useState<ThemeChoice>("system");

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

    setConfirm({ message });
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

  const isMember = member !== null && member.kind !== "none";
  const open = (url: string) => void WebBrowser.openBrowserAsync(url);
  const phoneStatus = !phone
    ? null
    : phone.status === "active"
      ? "Your check-in phone. Each student checks in from one phone."
      : phone.status === "pending"
        ? phone.needsAdmin
          ? `Waiting for your school admin to approve it.${phone.activeLabel ? ` ${phone.activeLabel} is still your check-in phone.` : ""}`
          : `Becomes your check-in phone on ${phone.activeFrom ? formatDayTime(phone.activeFrom) : "soon"}, unless your admin approves it sooner.`
        : "Replaced by another phone. You check in on your other phone.";

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <ProfileHeader
        name={isMember ? member.fullName : (session?.user.email ?? "")}
        lines={[session?.user.email, isMember ? member.school.name : null]}
      />

      {isMember ? (
        <SettingsGroup title="School" footer="One email and password work for all your schools and workspaces.">
          {/* Everyone sees this: students also use it to join a lecturer's workspace or another school. */}
          <SettingsRow
            icon="business-outline"
            title="Your schools and workspaces"
            subtitle={memberships.length > 1 ? `${memberships.length} in all. Tap to switch or join another.` : "Tap to join another."}
            onPress={() => router.push("/schools")}
          />
          <SettingsRow icon="key-outline" title={member.school.isWorkspace ? "Workspace code" : "School code"} value={member.school.code} />
          <SettingsRow icon="id-card-outline" title="School ID" value={member.schoolNumber ?? "None"} />
        </SettingsGroup>
      ) : null}

      {phone && phoneStatus ? (
        <SettingsGroup title="This phone">
          <SettingsRow icon="phone-portrait-outline" title={phone.label} subtitle={phoneStatus} />
        </SettingsGroup>
      ) : null}

      <SettingsGroup title="Preferences">
        <SettingsRow
          icon="notifications-outline"
          title="Notifications"
          subtitle="Choose which notifications you get"
          onPress={() => router.push("/notification-settings")}
        />
        <View>
          <SettingsRow icon="contrast-outline" title="Appearance" />
          <ThemeChooser
            value={theme}
            onChange={chooseTheme}
            options={[
              { value: "system", label: "Automatic" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </View>
      </SettingsGroup>

      <SettingsGroup title="Account">
        <SettingsRow icon="lock-closed-outline" title="Change password" external onPress={() => open(`${WEB_URL}/forgot-password`)} />
        <SettingsRow
          icon="log-out-outline"
          title="Sign out"
          onPress={() =>
            void forgetThisPhonesPush()
              .then(() => forgetActiveSchool())
              .then(() => supabase.auth.signOut({ scope: "local" }))
          }
        />
      </SettingsGroup>

      <SettingsGroup title="About">
        <SettingsRow icon="shield-checkmark-outline" title="Privacy policy" external onPress={() => open(`${WEB_URL}/privacy`)} />
        <SettingsRow icon="document-text-outline" title="Terms of Use" external onPress={() => open(APPLE_STANDARD_EULA_URL)} />
      </SettingsGroup>

      {error ? <Message>{error}</Message> : null}
      <SettingsGroup footer="Deleting your account removes your RollCol data. If your school also uses Stediis, your Stediis account is not affected.">
        <SettingsRow icon="trash-outline" title="Delete account" danger busy={busy} onPress={() => void startDeletion()} />
      </SettingsGroup>

      <ConfirmDialog
        visible={confirm !== null}
        title="Delete your account?"
        message={confirm?.message}
        confirmLabel="Delete"
        danger
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          void deleteAccount();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 24, paddingBottom: 40 },
});
