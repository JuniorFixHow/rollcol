import { describeDatabaseError } from "@rollcol/shared";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SectionTitle } from "@/components/kit";
import { usePalette } from "@/components/theme";
import { Body, Button, Field, Message } from "@/components/ui";
import { ghanaDate } from "@/lib/format";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

interface Semester {
  id: string;
  name: string;
}

export default function NewCourseScreen() {
  const { member } = useSession();
  const palette = usePalette();
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [semesterId, setSemesterId] = useState<string | null>(null);
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const schoolId = member && member.kind !== "none" ? member.school.id : "";

  useEffect(() => {
    if (!schoolId) return;
    void supabase
      .from("academic_periods")
      .select("id, name")
      .eq("school_id", schoolId)
      .gte("ends_on", ghanaDate())
      .order("starts_on")
      .then(({ data }) => {
        setSemesters(data ?? []);
        setSemesterId(data?.[0]?.id ?? null);
      });
    void supabase
      .from("school_settings")
      .select("course_approval_required")
      .eq("school_id", schoolId)
      .maybeSingle()
      .then(({ data }) => setApprovalRequired(data?.course_approval_required ?? true));
  }, [schoolId]);

  async function save() {
    setError(null);
    if (!/^[A-Za-z0-9 -]{2,20}$/.test(code.trim())) return setError("Enter a course code of 2 to 20 letters and numbers, for example NUR 201.");
    if (!semesterId) return setError("There is no current semester. Ask an admin to add one.");
    setBusy(true);
    const { error: saveError } = await supabase.rpc("lecturer_add_course", {
      p_school_id: schoolId,
      p_code: code.trim(),
      p_title: title.trim(),
      p_period_id: semesterId,
    });
    setBusy(false);
    if (saveError) return setError(describeDatabaseError(saveError));
    router.back();
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Body muted>
        {approvalRequired
          ? "You become its lecturer. An admin approves it before students can join and you can run sessions."
          : "You become its lecturer, and students can join it straight away."}
      </Body>
      <Field label="Course code" placeholder="NUR 201" autoCapitalize="characters" value={code} onChangeText={setCode} maxLength={20} />
      <Field
        label="Title"
        hint="If the code already exists, its title is kept."
        placeholder="Medical Nursing"
        value={title}
        onChangeText={setTitle}
        maxLength={160}
      />
      {semesters.length > 1 ? (
        <>
          <SectionTitle>Semester</SectionTitle>
          <View style={styles.chips}>
            {semesters.map((semester) => {
              const selected = semester.id === semesterId;
              return (
                <Pressable
                  key={semester.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setSemesterId(semester.id)}
                  style={[
                    styles.chip,
                    { borderColor: selected ? palette.accent : palette.line, backgroundColor: selected ? palette.accentSoft : palette.surface },
                  ]}
                >
                  <Text style={{ color: selected ? palette.accent : palette.text, fontWeight: "600" }}>{semester.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : semesters[0] ? (
        <Body muted>Semester: {semesters[0].name}</Body>
      ) : null}
      {error ? <Message>{error}</Message> : null}
      <Button label="Add course" busy={busy} onPress={() => void save()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
});
