import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { usePalette } from "@/components/theme";
import { Button } from "@/components/ui";

/** RollCol's own dialog, matching the website's. */
function Frame({
  visible,
  title,
  message,
  onCancel,
  children,
}: {
  visible: boolean;
  title: string;
  message?: string;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  const palette = usePalette();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="Close" />
        <View style={styles.center} pointerEvents="box-none">
          <View
            accessibilityViewIsModal
            style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.line }]}
          >
            <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
            {message ? <Text style={[styles.message, { color: palette.muted }]}>{message}</Text> : null}
            {children}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  danger = false,
  busy = false,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Frame visible={visible} title={title} message={message} onCancel={onCancel}>
      <View style={styles.actions}>
        <Button label={confirmLabel} variant={danger ? "danger" : "primary"} busy={busy} onPress={onConfirm} />
        <Button label="Cancel" variant="secondary" onPress={onCancel} disabled={busy} />
      </View>
    </Frame>
  );
}

/** Asks for a reason, which is kept in the session's history. */
export function ReasonDialog({
  visible,
  title,
  message,
  confirmLabel,
  placeholder,
  danger = false,
  busy = false,
  error,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  placeholder?: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const palette = usePalette();
  const [reason, setReason] = useState("");
  const [missing, setMissing] = useState(false);
  const shownError = missing ? "Give a reason." : error;

  return (
    <Frame
      visible={visible}
      title={title}
      message={message}
      onCancel={() => {
        setReason("");
        setMissing(false);
        onCancel();
      }}
    >
      <Text style={[styles.label, { color: palette.text }]}>Reason</Text>
      <TextInput
        value={reason}
        onChangeText={(text) => {
          setReason(text);
          setMissing(false);
        }}
        placeholder={placeholder}
        placeholderTextColor={palette.muted}
        maxLength={300}
        autoFocus
        style={[
          styles.input,
          { color: palette.text, borderColor: shownError ? palette.danger : palette.line, backgroundColor: palette.background },
        ]}
      />
      <Text style={[styles.hint, { color: palette.muted }]}>Kept in the session&apos;s history.</Text>
      {shownError ? <Text style={[styles.hint, { color: palette.danger }]}>{shownError}</Text> : null}
      <View style={styles.actions}>
        <Button
          label={confirmLabel}
          variant={danger ? "danger" : "primary"}
          busy={busy}
          onPress={() => {
            if (reason.trim().length < 3) {
              setMissing(true);
              return;
            }
            onConfirm(reason.trim());
            setReason("");
          }}
        />
        <Button label="Cancel" variant="secondary" onPress={onCancel} disabled={busy} />
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.5)" },
  center: { flex: 1, justifyContent: "center", padding: 24 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 20, gap: 10, maxWidth: 440, width: "100%", alignSelf: "center" },
  title: { fontSize: 18, fontWeight: "700" },
  message: { fontSize: 15, lineHeight: 22 },
  label: { fontSize: 14, fontWeight: "600", marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16 },
  hint: { fontSize: 13 },
  actions: { gap: 10, marginTop: 8 },
});
