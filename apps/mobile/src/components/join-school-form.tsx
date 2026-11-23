import { describeDatabaseError, personNameSchema, schoolCodeSchema, schoolIdSchema } from "@rollcol/shared";
import { useState } from "react";
import { setSignInSchoolCode, useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { Button, Field, Message } from "./ui";

/**
 * Students join a tertiary school with its code and their school ID.
 * Used before someone belongs to any school, and to join another school later.
 */
export function JoinSchoolForm({ defaultName = "", onJoined }: { defaultName?: string; onJoined?: () => void }) {
  const { joinError, refresh } = useSession();
  const [schoolCode, setSchoolCode] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [fullName, setFullName] = useState(defaultName);
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
    // Open the school just joined.
    await setSignInSchoolCode(code.data);
    await refresh();
    setBusy(false);
    onJoined?.();
  }

  return (
    <>
      <Field label="School or workspace code" value={schoolCode} onChangeText={setSchoolCode} autoCapitalize="characters" autoCorrect={false} />
      <Field label="School ID" value={schoolId} onChangeText={setSchoolId} autoCapitalize="characters" autoCorrect={false} />
      <Field label="Full name" value={fullName} onChangeText={setFullName} textContentType="name" />
      {error ? <Message>{error}</Message> : null}
      <Button label="Join school" onPress={join} busy={busy} />
    </>
  );
}
