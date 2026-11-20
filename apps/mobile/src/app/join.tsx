import { describeDatabaseError, personNameSchema, schoolCodeSchema, schoolIdSchema } from "@rollcol/shared";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Body, Button, Field, Message, Screen, Title } from "@/components/ui";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

/** Signed in, but not part of a school yet. */
export default function JoinScreen() {
  const { joinError, refresh } = useSession();
  const [schoolCode, setSchoolCode] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(joinError);
  const [busy, setBusy] = useState(false);

  async function join() {
    setError(null);
    const code = schoolCodeSchema.safeParse(schoolCode);
    const number = schoolIdSchema.safeParse(schoolId);
    const name = personNameSchema.safeParse(fullName);
    const firstIssue = [code, number, name].find((result) => !result.success);
    if (firstIssue && !firstIssue.success) {
      setError(firstIssue.error.issues[0]?.message ?? "Check your details.");
      return;
    }
    if (!code.success || !number.success || !name.success) return;

    setBusy(true);
    const { error: joinFailed } = await supabase.rpc("join_school_as_student", {
      p_school_code: code.data,
      p_school_number: number.data,
      p_full_name: name.data,
    });
    if (joinFailed) {
      setBusy(false);
      setError(describeDatabaseError(joinFailed));
      return;
    }
    await supabase.auth.updateUser({ data: { pending_join: null } });
    await refresh();
    setBusy(false);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Title>Join your school</Title>
        <Body muted>
          Students: enter your school code and school ID. Teachers and lecturers: ask your school admin to invite you, then
          sign in with the details from the invite email.
        </Body>
      </View>
      <Field label="School code" value={schoolCode} onChangeText={setSchoolCode} autoCapitalize="characters" autoCorrect={false} />
      <Field label="School ID" value={schoolId} onChangeText={setSchoolId} autoCapitalize="characters" autoCorrect={false} />
      <Field label="Full name" value={fullName} onChangeText={setFullName} textContentType="name" />
      {error ? <Message>{error}</Message> : null}
      <Button label="Join school" onPress={join} busy={busy} />
      <Button label="Sign out" variant="link" onPress={() => void supabase.auth.signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4, marginTop: 24 },
});
