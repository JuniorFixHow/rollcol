import { periodLabel, rewardMarksSchema } from "@rollcol/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { usePalette } from "@/components/theme";
import { Body, Button, Field, Message, Title } from "@/components/ui";
import { startRegister } from "@/lib/registers";
import { useSession } from "@/lib/session";


function param(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

/** Choose the period (per-period schools) and optional marks, then start. */
export default function StartRegisterScreen() {
  const params = useLocalSearchParams();
  const classId = param(params.classId);
  const className = param(params.className);
  const classSubjectId = param(params.classSubjectId) || null;
  const subjectName = param(params.subjectName) || null;
  const periodsPerDay = Math.min(Math.max(Number(param(params.periodsPerDay)) || 10, 1), 20);
  const periods = Array.from({ length: periodsPerDay }, (_, index) => index + 1);
  const { member } = useSession();
  const palette = usePalette();
  const [period, setPeriod] = useState<number | null>(null);
  const [marks, setMarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!member || member.kind !== "staff") return null;
  const schoolId = member.school.id;

  async function start() {
    setError(null);
    if (classSubjectId && !period) {
      setError("Choose the period.");
      return;
    }
    const reward = rewardMarksSchema.safeParse(marks.trim());
    if (!reward.success) {
      setError(reward.error.issues[0]?.message ?? "Check the marks.");
      return;
    }
    setBusy(true);
    try {
      const id = await startRegister({
        schoolId,
        classId,
        className,
        classSubjectId,
        subjectName,
        periodNumber: classSubjectId ? period : null,
        rewardMarks: reward.data,
      });
      router.replace({ pathname: "/register/[id]", params: { id } });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not start the register.");
      setBusy(false);
    }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Title>{subjectName ? `${className}, ${subjectName}` : className}</Title>
        <Body muted>Today&apos;s register. It works offline too: marks are sent when you are back online.</Body>
      </View>

      {classSubjectId ? (
        <View style={styles.group}>
          <Text style={[styles.label, { color: palette.text }]}>Period</Text>
          <View style={styles.chips}>
            {periods.map((number) => {
              const selected = period === number;
              return (
                <Pressable
                  key={number}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={periodLabel(number)}
                  onPress={() => setPeriod(number)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected ? palette.accent : palette.surface,
                      borderColor: selected ? palette.accent : palette.line,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: selected ? palette.accentText : palette.text }]}>{number}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <Field
        label="Marks for attending (optional)"
        hint="Every child marked present or late gets these marks. Leave blank for none."
        value={marks}
        // Digits and one decimal point only: no minus sign, no letters.
        onChangeText={(text) => setMarks(text.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
        keyboardType="decimal-pad"
        placeholder="0"
      />

      {error ? <Message>{error}</Message> : null}
      <Button label="Take register" onPress={() => void start()} busy={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 20 },
  header: { gap: 4 },
  group: { gap: 8 },
  label: { fontSize: 14, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { width: 48, height: 44, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  chipText: { fontSize: 16, fontWeight: "600" },
});
