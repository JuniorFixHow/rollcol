import { describeDatabaseError, parseSessionQr } from "@rollcol/shared";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePalette } from "@/components/theme";
import { Body, Button, Message } from "@/components/ui";
import { type CheckedIn, type Position, confirmItsYou, currentPosition, sendCheckIn } from "@/lib/checkin";
import { formatTime } from "@/lib/format";
import { type OpenSession } from "@/lib/sessions";
import { supabase } from "@/lib/supabase";

type Step =
  | { kind: "loading" }
  | { kind: "confirming" }
  | { kind: "locating" }
  | { kind: "scanning"; position: Position | null }
  | { kind: "sending" }
  | { kind: "done"; result: CheckedIn }
  | { kind: "failed"; message: string; settings?: boolean };

export default function CheckInScreen() {
  // "t" is the code when the check-in link was opened from a camera or QR app.
  const { id, t } = useLocalSearchParams<{ id: string; t?: string }>();
  const palette = usePalette();
  const [session, setSession] = useState<OpenSession | null>(null);
  const [step, setStep] = useState<Step>({ kind: "loading" });
  const [camera, requestCamera] = useCameraPermissions();
  const scanned = useRef(false);
  const started = useRef(false);
  // A pass from claim_qr: the scanned code, checked straight away so it cannot
  // expire during Face ID and finding the location.
  const pass = useRef<string | null>(null);

  const submit = useCallback(
    async (position: Position | null, qrToken: string | null) => {
      setStep({ kind: "sending" });
      const result = await sendCheckIn({ sessionId: id, position, qrToken });
      if (result.ok) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStep({ kind: "done", result: result.value });
      } else {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setStep({ kind: "failed", message: result.message, settings: result.settings });
      }
    },
    [id],
  );

  const run = useCallback(
    async (current: OpenSession) => {
      // 1. It is you.
      setStep({ kind: "confirming" });
      const me = await confirmItsYou(current.course_code);
      if (!me.ok) {
        setStep({ kind: "failed", message: me.message, settings: me.settings });
        return;
      }
      // 2. Where you are (only for sessions with a location check).
      let position: Position | null = null;
      if (current.needs_location) {
        setStep({ kind: "locating" });
        const found = await currentPosition();
        if (!found.ok) {
          setStep({ kind: "failed", message: found.message, settings: found.settings });
          return;
        }
        position = found.value;
      }
      // 3. The code on the lecturer's screen, scanned last so it is fresh
      //    (unless it came with the link and was claimed already).
      if (current.qr_required && pass.current) {
        await submit(position, pass.current);
        return;
      }
      if (current.qr_required) {
        scanned.current = false;
        setStep({ kind: "scanning", position });
        return;
      }
      await submit(position, null);
    },
    [submit],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const { data } = await supabase.rpc("my_open_sessions");
      const current = (data ?? []).find((row) => row.session_id === id) ?? null;
      if (!current) {
        setStep({ kind: "failed", message: "This session is not open for you any more." });
        return;
      }
      setSession(current);
      if (current.qr_required && !current.checked_in_at && typeof t === "string" && /^[0-9a-f]{12}$/i.test(t)) {
        setStep({ kind: "sending" });
        const { data: claimed, error: claimError } = await supabase.rpc("claim_qr", { p_session_id: id, p_token: t });
        if (claimError || !claimed) {
          setStep({
            kind: "failed",
            message: claimError ? describeDatabaseError(claimError) : "That code could not be used. Scan it again.",
          });
          return;
        }
        pass.current = claimed;
      }
      if (current.checked_in_at) {
        setStep({
          kind: "failed",
          message: `You already checked in to ${current.course_code} at ${formatTime(current.checked_in_at)}.`,
        });
        return;
      }
      await run(current);
    })();
  }, [id, run, t]);

  const onScan = useCallback(
    (data: string, position: Position | null) => {
      if (scanned.current) return;
      const code = parseSessionQr(data);
      if (!code) return; // Not a RollCol code: keep scanning.
      scanned.current = true;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (code.sessionId !== id) {
        setStep({ kind: "failed", message: "That code is for a different class. Scan the code for this session." });
        return;
      }
      void submit(position, code.token);
    },
    [id, submit],
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.background }]} edges={["top", "bottom"]}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={palette.text} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={[styles.code, { color: palette.muted }]}>{session?.course_code ?? ""}</Text>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
            {session?.course_title ?? "Check in"}
          </Text>
        </View>
      </View>

      {step.kind === "scanning" ? (
        camera?.granted ? (
          <View style={styles.flex}>
            <CameraView
              style={styles.flex}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={({ data }) => onScan(data, step.position)}
            />
            <View style={[styles.scanNote, { backgroundColor: palette.surface }]}>
              <Body>Point your camera at the code on your lecturer&apos;s screen.</Body>
            </View>
          </View>
        ) : (
          <View style={styles.center}>
            <Ionicons name="camera-outline" size={48} color={palette.muted} />
            <Body>This class also needs the code on your lecturer&apos;s screen. RollCol uses the camera only to scan it.</Body>
            {camera && !camera.canAskAgain ? (
              <Button label="Open Settings" onPress={() => void Linking.openSettings()} />
            ) : (
              <Button label="Allow camera" onPress={() => void requestCamera()} />
            )}
          </View>
        )
      ) : (
        <View style={styles.center}>
          {step.kind === "done" ? (
            <>
              <View style={[styles.tick, { backgroundColor: palette.successSoft }]}>
                <Ionicons name="checkmark" size={56} color={palette.success} />
              </View>
              <Text style={[styles.big, { color: palette.text }]}>You&apos;re checked in</Text>
              <Body muted>
                {step.result.courseCode} at {formatTime(step.result.checkedInAt)}
                {step.result.distance !== null ? `, ${Math.round(step.result.distance)} m from the class` : ""}
                {step.result.marks > 0 ? `. ${step.result.marks} ${Number(step.result.marks) === 1 ? "mark" : "marks"}.` : "."}
              </Body>
              <Button label="Done" onPress={() => router.back()} />
            </>
          ) : step.kind === "failed" ? (
            <>
              <Ionicons name="alert-circle-outline" size={56} color={palette.danger} />
              <Message>{step.message}</Message>
              {step.settings ? <Button label="Open Settings" variant="secondary" onPress={() => void Linking.openSettings()} /> : null}
              {session && !session.checked_in_at ? (
                <Button
                  label="Try again"
                  onPress={() => {
                    // A used or expired pass is not reused: scan again in the app.
                    pass.current = null;
                    void run(session);
                  }}
                />
              ) : null}
              <Button label="Close" variant="secondary" onPress={() => router.back()} />
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color={palette.accent} />
              <Body muted>
                {step.kind === "confirming"
                  ? "Confirm it's you..."
                  : step.kind === "locating"
                    ? "Finding your location..."
                    : step.kind === "sending"
                      ? "Checking you in..."
                      : "Loading..."}
              </Body>
            </>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 12 },
  code: { fontSize: 13, fontWeight: "600" },
  title: { fontSize: 18, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  tick: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center" },
  big: { fontSize: 24, fontWeight: "700" },
  scanNote: { padding: 16 },
});
