import { type Member, sessionState, staffRoleLabel } from "@rollcol/shared";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Badge, Empty, PullHint, SectionTitle, usePullHint } from "@/components/kit";
import { usePalette } from "@/components/theme";
import { TodayRegisters } from "@/components/today-registers";
import { Body, Button, Card, Message, Title } from "@/components/ui";
import { formatDayTime, formatDuration, formatTime } from "@/lib/format";
import { usePhone } from "@/lib/phone";
import { syncOutbox } from "@/lib/registers";
import { type OpenSession, useLecturerSessions, useOpenSessions } from "@/lib/sessions";
import { useSession } from "@/lib/session";

type SchoolMember = Exclude<Member, { kind: "none" }>;

export default function TodayScreen() {
  const { member, refresh } = useSession();
  if (!member || member.kind === "none") return null;
  if (member.kind === "student") return <StudentToday member={member} refreshSession={refresh} />;
  if (member.school.type === "tertiary") return <LecturerToday member={member} refreshSession={refresh} />;
  return <TeacherToday member={member} refreshSession={refresh} />;
}

function Greeting({ member }: { member: SchoolMember }) {
  const role = member.kind === "student" ? "Student" : staffRoleLabel(member.role, member.school.type);
  return (
    <View style={styles.header}>
      <Title>Hello, {member.fullName.split(" ")[0]}</Title>
      <Body muted>
        {member.school.name} · {role} · {member.schoolNumber}
      </Body>
    </View>
  );
}

function AccountState({ member }: { member: SchoolMember }) {
  if (member.status === "pending") {
    return (
      <Message tone="warning">
        Your school has not approved your account yet. Once an admin approves you, pull down to refresh.
      </Message>
    );
  }
  if (member.status === "disabled") {
    return <Message>Your school has turned off your account. Speak to your school admin if this is a mistake.</Message>;
  }
  return null;
}

function useRefresher(reload: () => Promise<void>, refreshSession: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);
  const hint = usePullHint();
  const onRefresh = useCallback(async () => {
    hint.markPulled();
    setRefreshing(true);
    await refreshSession();
    await reload();
    setRefreshing(false);
  }, [hint, reload, refreshSession]);
  return { refreshing, onRefresh, showHint: hint.show };
}

/* -------------------------------------------------------------------------- */
/* Students                                                                   */
/* -------------------------------------------------------------------------- */

function PhoneNotice() {
  const { phone, error } = usePhone();
  if (error) return <Message tone="warning">{error}</Message>;
  if (!phone) return null;
  if (phone.status === "pending") {
    return (
      <Message tone="warning">
        {phone.needsAdmin
          ? `This is a new phone. Your school admin must approve it before you can check in here. Until then, check in on ${phone.activeLabel ?? "your other phone"} or ask your lecturer to add you.`
          : `This is a new phone. It becomes your check-in phone on ${phone.activeFrom ? formatDayTime(phone.activeFrom) : "soon"}, unless your admin approves it sooner. Until then, ask your lecturer to add you.`}
      </Message>
    );
  }
  if (phone.status === "replaced" || phone.status === "cancelled") {
    return <Message>You now check in on another phone. To use this one again, sign in here and ask your school admin.</Message>;
  }
  return null;
}

function StudentToday({ member, refreshSession }: { member: SchoolMember; refreshSession: () => Promise<void> }) {
  const palette = usePalette();
  const { sessions, loading, failed, reload } = useOpenSessions(member.school.id);
  const { refresh: refreshPhone } = usePhone();
  const { refreshing, onRefresh, showHint } = useRefresher(
    useCallback(async () => {
      await Promise.all([reload(), refreshPhone()]);
    }, [reload, refreshPhone]),
    refreshSession,
  );
  const now = Date.now();
  const open = sessions.filter((s) => new Date(s.starts_at).getTime() <= now);
  const later = sessions.filter((s) => new Date(s.starts_at).getTime() > now);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} />}
    >
      <PullHint show={showHint} />
      <Greeting member={member} />
      <AccountState member={member} />
      {member.status === "active" ? (
        <>
          <PhoneNotice />
          <SectionTitle>Open now</SectionTitle>
          {failed ? <Message tone="warning">RollCol could not load your classes. Check your connection and pull down.</Message> : null}
          {!loading && open.length === 0 ? (
            <Empty icon="time-outline">
              No class is open for check-in right now. You get a notification when your lecturer opens one.
            </Empty>
          ) : null}
          {open.map((session) => (
            <SessionCard key={session.session_id} session={session} />
          ))}
          {later.length > 0 ? <SectionTitle>Later today</SectionTitle> : null}
          {later.map((session) => (
            <SessionCard key={session.session_id} session={session} />
          ))}
          <Pressable onPress={() => router.navigate("/courses")} style={styles.linkRow}>
            <Text style={[styles.link, { color: palette.accent }]}>Your courses and attendance</Text>
            <Ionicons name="chevron-forward" size={16} color={palette.accent} />
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}

function SessionCard({ session }: { session: OpenSession }) {
  const palette = usePalette();
  const now = Date.now();
  const started = new Date(session.starts_at).getTime() <= now;
  return (
    <Card>
      <View style={styles.cardTop}>
        <View style={styles.flex}>
          <Text style={[styles.code, { color: palette.muted }]}>{session.course_code}</Text>
          <Text style={[styles.cardTitle, { color: palette.text }]}>{session.course_title}</Text>
        </View>
        {session.checked_in_at ? <Badge tone="success">Checked in</Badge> : null}
      </View>
      <Body muted>
        {started
          ? `Open until ${formatTime(session.ends_at)} · closes in ${formatDuration(new Date(session.ends_at).getTime() - now)}`
          : `Opens at ${formatTime(session.starts_at)}`}
      </Body>
      <View style={styles.badges}>
        {session.needs_location ? <Badge>Location</Badge> : null}
        {session.qr_required ? <Badge>Scan code</Badge> : null}
        {session.reward_marks > 0 ? <Badge tone="accent">{`${session.reward_marks} ${Number(session.reward_marks) === 1 ? "mark" : "marks"}`}</Badge> : null}
      </View>
      {session.checked_in_at ? (
        <Body>Checked in at {formatTime(session.checked_in_at)}.</Body>
      ) : started ? (
        <Button label="Check in" onPress={() => router.push({ pathname: "/checkin/[id]", params: { id: session.session_id } })} />
      ) : null}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Lecturers                                                                  */
/* -------------------------------------------------------------------------- */

function LecturerToday({ member, refreshSession }: { member: SchoolMember; refreshSession: () => Promise<void> }) {
  const palette = usePalette();
  const { sessions, loading, failed, reload } = useLecturerSessions(member.school.id);
  const { refreshing, onRefresh, showHint } = useRefresher(reload, refreshSession);
  const live = sessions
    .map((s) => ({ ...s, state: sessionState(s) }))
    .filter((s) => s.state === "open" || s.state === "scheduled")
    .reverse();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} />}
    >
      <PullHint show={showHint} />
      <Greeting member={member} />
      <AccountState member={member} />
      {member.status === "active" ? (
        <>
          <Button label="Start a session" onPress={() => router.push("/session/start")} />
          <SectionTitle>Open and scheduled</SectionTitle>
          {failed ? <Message tone="warning">RollCol could not load your sessions. Pull down to try again.</Message> : null}
          {!loading && live.length === 0 ? (
            <Empty icon="qr-code-outline">No session is open. Start one when your class begins.</Empty>
          ) : null}
          {live.map((session) => {
            const present = session.session_checkins[0]?.count ?? 0;
            const enrolled = session.course_run?.enrolments[0]?.count ?? 0;
            return (
              <Pressable
                key={session.id}
                onPress={() => router.push({ pathname: "/session/[id]", params: { id: session.id } })}
              >
                <Card>
                  <View style={styles.cardTop}>
                    <View style={styles.flex}>
                      <Text style={[styles.code, { color: palette.muted }]}>{session.course_run?.course?.code}</Text>
                      <Text style={[styles.cardTitle, { color: palette.text }]}>{session.course_run?.course?.title}</Text>
                    </View>
                    <Badge tone={session.state === "open" ? "success" : "accent"}>
                      {session.state === "open" ? "Open" : "Scheduled"}
                    </Badge>
                  </View>
                  <Body muted>
                    {session.state === "open"
                      ? `${present} of ${enrolled} checked in · until ${formatTime(session.ends_at)}`
                      : `Opens ${formatDayTime(session.starts_at)}`}
                  </Body>
                </Card>
              </Pressable>
            );
          })}
        </>
      ) : null}
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/* Teachers (basic and senior high schools)                                   */
/* -------------------------------------------------------------------------- */

function TeacherToday({ member, refreshSession }: { member: SchoolMember; refreshSession: () => Promise<void> }) {
  const palette = usePalette();
  // Bumped on pull-to-refresh and when returning to this screen, so the list reloads.
  const [refreshKey, setRefreshKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setRefreshKey((key) => key + 1);
    }, []),
  );
  const { refreshing, onRefresh, showHint } = useRefresher(
    useCallback(async () => {
      await syncOutbox();
      setRefreshKey((key) => key + 1);
    }, []),
    refreshSession,
  );

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} />}
    >
      <PullHint show={showHint} />
      <Greeting member={member} />
      <AccountState member={member} />
      {member.status === "active" ? (
        <Card>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Today&apos;s registers</Text>
          <TodayRegisters
            schoolId={member.school.id}
            perPeriod={member.school.registerMode === "per_period"}
            refreshKey={refreshKey}
          />
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14 },
  header: { gap: 4 },
  flex: { flex: 1 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  code: { fontSize: 13, fontWeight: "600" },
  cardTitle: { fontSize: 17, fontWeight: "600" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  link: { fontSize: 16, fontWeight: "600" },
});
