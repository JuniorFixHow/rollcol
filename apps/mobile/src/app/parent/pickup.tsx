import { describeDatabaseError, normalisePhone } from "@rollcol/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { ChoiceChips, nextDays } from "@/components/choice-chips";
import { usePalette } from "@/components/theme";
import { Body, Button, Card, Field, Message } from "@/components/ui";
import { ghanaDate } from "@/lib/format";
import { supabase } from "@/lib/supabase";

/** A pickup code for someone else to collect the child. */
export default function PickupCodeScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const palette = usePalette();
  const first = (name ?? "your child").split(/\s+/)[0] ?? "your child";
  const days = nextDays(ghanaDate(), 8);
  const [day, setDay] = useState(days[0]?.value ?? "");
  const [collector, setCollector] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  async function make() {
    setError(null);
    if (collector.trim().length < 2) {
      setError(`Type the name of the person collecting ${first}.`);
      return;
    }
    const normalised = phone.trim() ? normalisePhone(phone) : null;
    if (phone.trim() && !normalised) {
      setError("Check the collector's phone number, or leave it empty.");
      return;
    }
    setBusy(true);
    const { data, error: makeError } = await supabase.rpc("parent_create_pickup", {
      p_student_id: id,
      p_date: day,
      p_collector_name: collector.trim(),
      p_collector_phone: normalised,
    });
    setBusy(false);
    if (makeError) setError(describeDatabaseError(makeError));
    else setCode(data[0]?.code ?? null);
  }

  const dayLabel = days.find((d) => d.value === day)?.label.toLowerCase() ?? "";

  if (code) {
    const text = `RollCol pickup code for ${name ?? first}: ${code}. Give it to the teacher when you collect ${first} (${dayLabel === "today" || dayLabel === "tomorrow" ? dayLabel : `on ${days.find((d) => d.value === day)?.label ?? day}`}).`;
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Body muted>Pickup code for {collector.trim()}</Body>
          <Text selectable style={[styles.code, { color: palette.text }]} accessibilityLabel={`Code ${code.split("").join(" ")}`}>
            {code}
          </Text>
          <Body muted>
            Works once, {dayLabel === "today" || dayLabel === "tomorrow" ? dayLabel : `on ${days.find((d) => d.value === day)?.label ?? day}`}. The teacher asks for it
            before releasing {first}, and you are told when {first} is collected.
          </Body>
        </Card>
        <Button label="Share the code" onPress={() => void Share.share({ message: text })} />
        <Button label="Done" variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Body>
        If someone else collects {first}, make a code and give it to them. The teacher asks for it before releasing {first}.
      </Body>
      <Field label="Who collects" hint="Their full name, as they will tell the teacher." value={collector} onChangeText={setCollector} autoCapitalize="words" />
      <Field label="Their phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <ChoiceChips label="Day" options={days} value={day} onChange={setDay} />
      {error ? <Message>{error}</Message> : null}
      <View style={styles.gap} />
      <Button label="Make a code" onPress={() => void make()} busy={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 16 },
  code: { fontSize: 44, fontWeight: "800", letterSpacing: 8, fontVariant: ["tabular-nums"], marginVertical: 8 },
  gap: { height: 4 },
});
