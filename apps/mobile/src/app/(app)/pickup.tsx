import { type Database, describeDatabaseError, formatPhoneForDisplay } from "@rollcol/shared";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ConfirmDialog } from "@/components/dialog";
import { usePalette } from "@/components/theme";
import { Body, Button, Card, Field, Message } from "@/components/ui";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

type Found = Database["public"]["Functions"]["check_pickup_code"]["Returns"][number];

/** A teacher types the collector's code and sees the child and who may take them. */
export default function PickupCheckScreen() {
  const { member } = useSession();
  const palette = usePalette();
  const [code, setCode] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const schoolId = member && member.kind !== "none" ? member.school.id : "";

  async function check() {
    setError(null);
    setNotice(null);
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 6) {
      setError("Type the six digits of the code.");
      return;
    }
    setBusy(true);
    const { data, error: checkError } = await supabase.rpc("check_pickup_code", { p_school_id: schoolId, p_code: digits });
    setBusy(false);
    if (checkError) setError(describeDatabaseError(checkError));
    else if (!data[0]) setError("No code for today matches. Check the digits with the collector, or call the parent.");
    else setFound(data[0]);
  }

  async function release() {
    if (!found) return;
    setBusy(true);
    const { error: releaseError } = await supabase.rpc("release_pickup", { p_id: found.id });
    setBusy(false);
    setConfirm(false);
    if (releaseError) {
      setError(describeDatabaseError(releaseError));
      return;
    }
    setNotice(`${found.student_name} was released to ${found.collector_name}. The parent has been told.`);
    setFound(null);
    setCode("");
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {found ? (
        <>
          <Card>
            <Body muted>Code is valid for today</Body>
            <Text style={[styles.name, { color: palette.text }]}>{found.student_name}</Text>
            {found.class_name ? <Body>{found.class_name}</Body> : null}
            <View style={styles.details}>
              <Body muted>Collected by</Body>
              <Text style={[styles.collector, { color: palette.text }]}>
                {found.collector_name}
                {found.collector_phone ? ` · ${formatPhoneForDisplay(found.collector_phone)}` : ""}
              </Text>
              {found.parent_name ? <Body muted>Code made by {found.parent_name} (parent, in RollCol)</Body> : null}
            </View>
          </Card>
          <Body>Ask the collector for their name. Release the child only if it matches.</Body>
          {error ? <Message>{error}</Message> : null}
          <Button label={`Release ${found.student_name.split(/\s+/)[0] ?? "the child"}`} onPress={() => setConfirm(true)} busy={busy} />
          <Button
            label="Check another code"
            variant="secondary"
            onPress={() => {
              setFound(null);
              setCode("");
            }}
          />
        </>
      ) : (
        <>
          <Body>When someone other than a parent collects a child, the parent makes a code in RollCol. Type it here.</Body>
          {notice ? <Message tone="accent">{notice}</Message> : null}
          <Field
            label="Pickup code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="123456"
            onSubmitEditing={() => void check()}
          />
          {error ? <Message>{error}</Message> : null}
          <Button label="Check" onPress={() => void check()} busy={busy} />
        </>
      )}
      <ConfirmDialog
        visible={confirm}
        title={`Release ${found?.student_name ?? "this child"}?`}
        message={`To ${found?.collector_name ?? ""}. The code is then used, and the parent is told.`}
        confirmLabel="Release"
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void release()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 16 },
  name: { fontSize: 24, fontWeight: "700", marginTop: 4 },
  details: { marginTop: 12, gap: 2 },
  collector: { fontSize: 17, fontWeight: "600" },
});
