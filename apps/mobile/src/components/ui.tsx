import { APPLE_STANDARD_EULA_URL } from "@rollcol/shared";
import * as WebBrowser from "expo-web-browser";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WEB_URL } from "@/lib/supabase";
import { usePalette } from "./theme";

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const palette = usePalette();
  const body = <View style={styles.content}>{children}</View>;
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.background }]} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {scroll ? (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
            {body}
          </ScrollView>
        ) : (
          body
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const palette = usePalette();
  return <Text style={[styles.title, { color: palette.text }]}>{children}</Text>;
}

export function Body({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  const palette = usePalette();
  return <Text style={[styles.body, { color: muted ? palette.muted : palette.text }]}>{children}</Text>;
}

export function Card({ children }: { children: ReactNode }) {
  const palette = usePalette();
  return <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.line }]}>{children}</View>;
}

export function Field({
  label,
  hint,
  error,
  ...input
}: TextInputProps & { label: string; hint?: string; error?: string }) {
  const palette = usePalette();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
      {hint ? <Text style={[styles.hint, { color: palette.muted }]}>{hint}</Text> : null}
      <TextInput
        placeholderTextColor={palette.muted}
        accessibilityLabel={label}
        style={[
          styles.input,
          { backgroundColor: palette.surface, borderColor: error ? palette.danger : palette.line, color: palette.text },
        ]}
        {...input}
      />
      {error ? <Text style={[styles.hint, { color: palette.danger }]}>{error}</Text> : null}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  busy = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "link";
  busy?: boolean;
  disabled?: boolean;
}) {
  const palette = usePalette();
  const colors = {
    primary: { bg: palette.accent, fg: palette.accentText, border: palette.accent },
    secondary: { bg: palette.surface, fg: palette.text, border: palette.line },
    danger: { bg: palette.danger, fg: "#ffffff", border: palette.danger },
    link: { bg: "transparent", fg: palette.accent, border: "transparent" },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        variant === "link" ? styles.linkButton : styles.button,
        { backgroundColor: colors.bg, borderColor: colors.border, opacity: pressed || disabled ? 0.7 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={colors.fg} />
      ) : (
        <Text style={[styles.buttonText, { color: colors.fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Message({ tone = "danger", children }: { tone?: "danger" | "warning" | "accent"; children: ReactNode }) {
  const palette = usePalette();
  const map = {
    danger: { bg: palette.dangerSoft, fg: palette.danger },
    warning: { bg: palette.warningSoft, fg: palette.warning },
    accent: { bg: palette.accentSoft, fg: palette.accent },
  }[tone];
  return (
    <View accessibilityRole="alert" style={[styles.message, { backgroundColor: map.bg }]}>
      <Text style={[styles.body, { color: map.fg }]}>{children}</Text>
    </View>
  );
}

/** Required by Apple on sign-in and sign-up: privacy policy and Terms of Use (Apple's standard EULA). */
export function LegalLinks() {
  const palette = usePalette();
  return (
    <View style={styles.legal}>
      <Text
        accessibilityRole="link"
        style={[styles.hint, { color: palette.accent }]}
        onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}/privacy`)}
      >
        Privacy policy
      </Text>
      <Text style={[styles.hint, { color: palette.muted }]}>·</Text>
      <Text
        accessibilityRole="link"
        style={[styles.hint, { color: palette.accent }]}
        onPress={() => void WebBrowser.openBrowserAsync(APPLE_STANDARD_EULA_URL)}
      >
        Terms of Use
      </Text>
    </View>
  );
}

export function Loading() {
  const palette = usePalette();
  return (
    <View style={[styles.flex, styles.center, { backgroundColor: palette.background }]}>
      <ActivityIndicator color={palette.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  scroll: { flexGrow: 1 },
  content: { padding: 24, gap: 16, width: "100%", maxWidth: 480, alignSelf: "center" },
  title: { fontSize: 26, fontWeight: "700" },
  body: { fontSize: 15, lineHeight: 22 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 16, gap: 10 },
  field: { gap: 4 },
  label: { fontSize: 14, fontWeight: "600" },
  hint: { fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16 },
  button: { minHeight: 48, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  linkButton: { minHeight: 40, alignItems: "center", justifyContent: "center" },
  buttonText: { fontSize: 16, fontWeight: "600" },
  message: { borderRadius: 8, padding: 12 },
  legal: { flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 8 },
});
