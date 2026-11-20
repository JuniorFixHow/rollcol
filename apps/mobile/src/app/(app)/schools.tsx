import { staffRoleLabel } from "@rollcol/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { JoinSchoolForm } from "@/components/join-school-form";
import { usePalette } from "@/components/theme";
import { Body, Button, Card } from "@/components/ui";
import { useSession } from "@/lib/session";

/** Every school this person belongs to: switch between them, or join another. */
export default function SchoolsScreen() {
  const { member, memberships, switchSchool } = useSession();
  const palette = usePalette();
  const [joining, setJoining] = useState(false);
  const currentKey = member && member.kind !== "none" ? `${member.kind}-${member.id}` : null;
  const firstName = member && member.kind !== "none" ? member.fullName : "";

  async function open(schoolId: string) {
    await switchSchool(schoolId);
    router.back();
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <View style={styles.list}>
        {memberships.map((m) => {
          const key = `${m.kind}-${m.id}`;
          const current = key === currentKey;
          const role = m.kind === "staff" ? staffRoleLabel(m.role, m.school.type) : "Student";
          const state = m.status === "pending" ? " · Waiting for approval" : m.status === "disabled" ? " · Turned off" : "";
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected: current }}
              onPress={() => void open(m.school.id)}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: current ? palette.accentSoft : palette.surface,
                  borderColor: current ? palette.accent : palette.line,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={[styles.name, { color: palette.text }]}>{m.school.name}</Text>
              <Text style={[styles.meta, { color: palette.muted }]}>
                {role} · School ID {m.schoolNumber}
                {state}
              </Text>
              {current ? <Text style={[styles.meta, { color: palette.accent }]}>Open now</Text> : null}
            </Pressable>
          );
        })}
      </View>

      {joining ? (
        <Card>
          <Text style={[styles.name, { color: palette.text }]}>Join another school</Text>
          <Body muted>For students at universities, colleges and polytechnics that use RollCol.</Body>
          <JoinSchoolForm defaultName={firstName} onJoined={() => router.back()} />
        </Card>
      ) : (
        <View style={styles.list}>
          <Button label="Join another school as a student" variant="secondary" onPress={() => setJoining(true)} />
          <Body muted>Staff are added by their school admin. Ask them to invite the email you use for RollCol.</Body>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 24 },
  list: { gap: 12 },
  row: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 4 },
  name: { fontSize: 16, fontWeight: "600" },
  meta: { fontSize: 14 },
});
