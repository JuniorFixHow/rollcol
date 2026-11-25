import { ABSENCE_REASONS, type AbsenceReason, describeDatabaseError } from "@rollcol/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { ChoiceChips, nextDays } from "@/components/choice-chips";
import { Body, Button, Field, Message } from "@/components/ui";
import { ghanaDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { useChildChoices } from "@/lib/use-children";

/** Tells the school ahead that the child will be absent. */
export default function ReportAbsenceScreen() {
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const children = useChildChoices();
  const [chosen, setChosen] = useState<string | null>(params.id ?? null);
  const id = chosen ?? (children.length === 1 ? (children[0]?.value ?? null) : null);
  const name = params.name || children.find((c) => c.value === id)?.label;
  const first = (name ?? "your child").split(/\s+/)[0] ?? "your child";
  const days = nextDays(ghanaDate(), 14);
  const [from, setFrom] = useState(days[0]?.value ?? "");
  const [to, setTo] = useState(days[0]?.value ?? "");
  const [reason, setReason] = useState<AbsenceReason | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setError(null);
    if (!id) {
      setError("Choose the child.");
      return;
    }
    if (!reason) {
      setError("Choose a reason.");
      return;
    }
    setBusy(true);
    const { error: sendError } = await supabase.rpc("parent_report_absence", {
      p_student_id: id,
      p_from: from,
      p_to: to < from ? from : to,
      p_reason: reason,
      p_note: note.trim() || null,
    });
    setBusy(false);
    if (sendError) setError(describeDatabaseError(sendError));
    else router.back();
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Body>
        Tell the school ahead if {id ? first : "your child"} will be absent. The class teacher is told, your child starts as absent on
        the register, and you get no absence alert for those days.
      </Body>
      {!params.id && children.length > 1 ? <ChoiceChips label="Child" options={children} value={id} onChange={setChosen} /> : null}
      <ChoiceChips
        label="From"
        options={days.slice(0, 8)}
        value={from}
        onChange={(value) => {
          setFrom(value);
          if (to < value) setTo(value);
        }}
      />
      <ChoiceChips label="To" options={days.filter((d) => d.value >= from)} value={to} onChange={setTo} />
      <ChoiceChips
        label="Reason"
        options={Object.entries(ABSENCE_REASONS).map(([value, label]) => ({ value: value as AbsenceReason, label }))}
        value={reason}
        onChange={setReason}
      />
      <Field label="Note for the teacher (optional)" value={note} onChangeText={setNote} maxLength={300} multiline />
      {error ? <Message>{error}</Message> : null}
      <Button label="Report absence" onPress={() => void send()} busy={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: 24, gap: 18 } });
