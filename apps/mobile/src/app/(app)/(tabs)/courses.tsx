import { describeDatabaseError, type Database } from "@rollcol/shared";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { ConfirmDialog } from "@/components/dialog";
import { Badge, Empty, PullHint, Row, SectionTitle, usePullHint } from "@/components/kit";
import { usePalette } from "@/components/theme";
import { Body, Button, Message } from "@/components/ui";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

type Course = Database["public"]["Functions"]["my_courses"]["Returns"][number];

export default function CoursesScreen() {
  const { member } = useSession();
  const palette = usePalette();
  const hint = usePullHint();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState<Course | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const schoolId = member && member.kind !== "none" ? member.school.id : "";

  const load = useCallback(async () => {
    if (!schoolId) return;
    const { data, error: loadError } = await supabase.rpc("my_courses", { p_school_id: schoolId });
    setLoaded(true);
    setFailed(Boolean(loadError));
    if (!loadError) setCourses(data ?? []);
  }, [schoolId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onRefresh() {
    hint.markPulled();
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function join(course: Course) {
    setBusy(true);
    setError(null);
    const { error: joinError } = await supabase.rpc("join_course_run", { p_course_run_id: course.course_run_id });
    setBusy(false);
    setJoining(null);
    if (joinError) setError(describeDatabaseError(joinError));
    else await load();
  }

  if (!member || member.kind !== "student") return null;
  const mine = courses.filter((c) => c.enrolled);
  const others = courses.filter((c) => !c.enrolled);

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} />}
      >
        <PullHint show={hint.show} />
        {member.status !== "active" ? (
          <Message tone="warning">You can join courses once your school approves your account.</Message>
        ) : null}
        {failed ? <Message tone="warning">RollCol could not load your courses. Pull down to try again.</Message> : null}
        {error ? <Message>{error}</Message> : null}

        <SectionTitle>{courses[0] ? `Your courses · ${courses[0].semester}` : "Your courses"}</SectionTitle>
        {loaded && mine.length === 0 ? (
          <Empty icon="book-outline">Join the courses you are registered for below, so you can check in to their classes.</Empty>
        ) : null}
        {mine.map((course) => {
          const rate = course.sessions_held > 0 ? Math.round((course.attended / course.sessions_held) * 100) : null;
          return (
            <Row
              key={course.course_run_id}
              title={`${course.code} · ${course.title}`}
              subtitle={`${course.attended} of ${course.sessions_held} classes${course.marks > 0 ? ` · ${course.marks} marks` : ""}${course.lecturers ? `\n${course.lecturers}` : ""}`}
              right={rate !== null ? <Badge tone={rate >= 75 ? "success" : rate >= 50 ? "warning" : "danger"}>{`${rate}%`}</Badge> : null}
              onPress={() =>
                router.push({ pathname: "/course/[id]", params: { id: course.course_run_id, title: course.code } })
              }
            />
          );
        })}

        {member.status === "active" && others.length > 0 ? (
          <>
            <SectionTitle>Other courses this semester</SectionTitle>
            <Body muted>Join only the courses you are registered for. Your lecturer sees who joined.</Body>
            {others.map((course) => (
              <Row
                key={course.course_run_id}
                title={`${course.code} · ${course.title}`}
                subtitle={course.lecturers ?? undefined}
                right={
                  <View style={styles.join}>
                    <Button label="Join" variant="secondary" onPress={() => setJoining(course)} />
                  </View>
                }
              />
            ))}
          </>
        ) : null}
      </ScrollView>
      <ConfirmDialog
        visible={joining !== null}
        title={`Join ${joining?.code ?? "this course"}?`}
        message={`${joining?.title ?? ""}. You will get notifications when its classes open, and can check in to them.`}
        confirmLabel="Join"
        busy={busy}
        onCancel={() => setJoining(null)}
        onConfirm={() => joining && void join(joining)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12 },
  join: { minWidth: 80 },
});
