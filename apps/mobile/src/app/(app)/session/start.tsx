import { QR_SECONDS, SESSION_MINUTES, SESSION_RADIUS, describeDatabaseError } from "@rollcol/shared";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Empty, SectionTitle } from "@/components/kit";
import { usePalette } from "@/components/theme";
import { Body, Button, Field, Message } from "@/components/ui";
import { type MyRun, loadMyRuns } from "@/lib/runs";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

interface Venue {
  id: string;
  name: string;
  radius_m: number;
  verified: boolean;
}

type Where = { kind: "here" } | { kind: "venue"; id: string } | { kind: "none" };

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: selected ? palette.accent : palette.line, backgroundColor: selected ? palette.accentSoft : palette.surface },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? palette.accent : palette.text }]}>{label}</Text>
    </Pressable>
  );
}

export default function StartSessionScreen() {
  const { member } = useSession();
  const palette = usePalette();
  const [runs, setRuns] = useState<MyRun[] | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(String(SESSION_MINUTES.default));
  const [where, setWhere] = useState<Where>({ kind: "here" });
  const [radius, setRadius] = useState("");
  const [marks, setMarks] = useState("");
  const [qr, setQr] = useState(true);
  const [qrSeconds, setQrSeconds] = useState(String(QR_SECONDS.default));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; settings?: boolean } | null>(null);

  useEffect(() => {
    if (!member || member.kind !== "staff") return;
    void loadMyRuns(member.school.id, member.id, member.role === "admin").then((all) => {
      const usable = all.filter((run) => run.approved_at !== null);
      setRuns(usable);
      if (usable.length === 1) setRunId(usable[0]?.id ?? null);
    });
    void supabase.rpc("school_venues", { p_school_id: member.school.id }).then(({ data }) => setVenues(data ?? []));
  }, [member]);

  if (!member || member.kind !== "staff") return null;

  async function start() {
    setError(null);
    if (!runId) return setError({ message: "Choose a course." });
    const mins = Number(minutes);
    if (!Number.isInteger(mins) || mins < SESSION_MINUTES.min || mins > SESSION_MINUTES.max) {
      return setError({ message: `Open for ${SESSION_MINUTES.min} to ${SESSION_MINUTES.max} minutes.` });
    }
    const radiusValue = radius.trim() === "" ? null : Number(radius);
    if (radiusValue !== null && (!Number.isInteger(radiusValue) || radiusValue < SESSION_RADIUS.min || radiusValue > SESSION_RADIUS.max)) {
      return setError({ message: `The radius is ${SESSION_RADIUS.min} to ${SESSION_RADIUS.max} metres.` });
    }
    const marksValue = marks.trim() === "" ? 0 : Number(marks);
    if (Number.isNaN(marksValue) || marksValue < 0 || marksValue > 100 || marksValue * 4 !== Math.floor(marksValue * 4)) {
      return setError({ message: "Marks are 0 to 100, in quarters (for example 1 or 0.5)." });
    }
    const seconds = Number(qrSeconds);
    if (qr && (!Number.isInteger(seconds) || seconds < QR_SECONDS.min || seconds > QR_SECONDS.max)) {
      return setError({ message: `The code changes every ${QR_SECONDS.min} to ${QR_SECONDS.max} seconds.` });
    }
    if (where.kind === "none" && !qr) {
      return setError({ message: "Without a location check, use the rotating code, or students could check in from anywhere." });
    }

    setBusy(true);
    let lat: number | null = null;
    let lng: number | null = null;
    let accuracy: number | null = null;
    if (where.kind === "here") {
      setStatus("Finding your location...");
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setBusy(false);
        setStatus(null);
        return setError({
          message: "RollCol needs your location to set where students check in. Allow it in Settings, or choose a venue.",
          settings: true,
        });
      }
      try {
        const reading = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
        lat = reading.coords.latitude;
        lng = reading.coords.longitude;
        accuracy = reading.coords.accuracy ?? 9999;
      } catch {
        setBusy(false);
        setStatus(null);
        return setError({ message: "We could not find your location. Move near a window and try again, or choose a venue." });
      }
    }

    setStatus("Starting...");
    const { data, error: startError } = await supabase.rpc("start_session", {
      p_course_run_id: runId,
      p_minutes: mins,
      p_venue_id: where.kind === "venue" ? where.id : null,
      p_lat: lat,
      p_lng: lng,
      p_accuracy: accuracy,
      p_radius_m: radiusValue,
      p_reward_marks: marksValue,
      p_qr_required: qr,
      p_qr_seconds: qr ? seconds : 15,
    });
    setBusy(false);
    setStatus(null);
    if (startError) return setError({ message: describeDatabaseError(startError) });
    router.replace({ pathname: "/session/[id]", params: { id: data.id } });
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SectionTitle>Course</SectionTitle>
      {runs !== null && runs.length === 0 ? (
        <Empty icon="book-outline">
          No approved courses this semester. Add a course you teach on the Sessions tab, or ask an admin.
        </Empty>
      ) : null}
      <View style={styles.chips}>
        {(runs ?? []).map((run) => (
          <Chip key={run.id} label={run.course?.code ?? "Course"} selected={runId === run.id} onPress={() => setRunId(run.id)} />
        ))}
      </View>
      {runId ? <Body muted>{runs?.find((run) => run.id === runId)?.course?.title}</Body> : null}

      <Field label="Open for (minutes)" value={minutes} onChangeText={setMinutes} keyboardType="number-pad" maxLength={3} />

      <SectionTitle>Where</SectionTitle>
      <View style={styles.chips}>
        <Chip label="Here (my location)" selected={where.kind === "here"} onPress={() => setWhere({ kind: "here" })} />
        {venues.map((venue) => (
          <Chip
            key={venue.id}
            label={`${venue.name}${venue.verified ? "" : " (unverified)"}`}
            selected={where.kind === "venue" && where.id === venue.id}
            onPress={() => setWhere({ kind: "venue", id: venue.id })}
          />
        ))}
        <Chip label="No location check" selected={where.kind === "none"} onPress={() => setWhere({ kind: "none" })} />
      </View>
      <Body muted>
        {where.kind === "here"
          ? "Your phone's location becomes the centre of the check-in area. Stand in the room."
          : where.kind === "venue"
            ? "Students check in within the venue's radius."
            : "Students only need the rotating code on your screen."}
      </Body>
      {where.kind !== "none" ? (
        <Field
          label="Radius in metres (optional)"
          hint={`${SESSION_RADIUS.min} to ${SESSION_RADIUS.max}. Leave empty for ${where.kind === "venue" ? "the venue's radius" : SESSION_RADIUS.default}.`}
          value={radius}
          onChangeText={setRadius}
          keyboardType="number-pad"
          maxLength={4}
        />
      ) : null}

      <Field
        label="Marks (optional)"
        hint="Added to each student who attends."
        value={marks}
        onChangeText={(text) => setMarks(text.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
        keyboardType="decimal-pad"
        maxLength={6}
      />

      <View style={[styles.switchRow, { borderColor: palette.line, backgroundColor: palette.surface }]}>
        <View style={styles.flex}>
          <Text style={[styles.switchTitle, { color: palette.text }]}>Rotating code</Text>
          <Text style={{ color: palette.muted }}>Students also scan a code on your screen that keeps changing.</Text>
        </View>
        <Switch value={qr} onValueChange={setQr} trackColor={{ true: palette.accent }} />
      </View>
      {qr ? (
        <Field
          label="Code changes every (seconds)"
          hint={`${QR_SECONDS.min} to ${QR_SECONDS.max}.`}
          value={qrSeconds}
          onChangeText={setQrSeconds}
          keyboardType="number-pad"
          maxLength={2}
        />
      ) : null}

      {error ? <Message>{error.message}</Message> : null}
      {error?.settings ? <Button label="Open Settings" variant="secondary" onPress={() => void Linking.openSettings()} /> : null}
      <Button label={status ?? "Start session"} busy={busy} onPress={() => void start()} />
      <Body muted>To schedule a session for later, use the RollCol website.</Body>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 15, fontWeight: "600" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14 },
  switchTitle: { fontSize: 16, fontWeight: "600" },
  flex: { flex: 1 },
});
