import { periodWord, staffRoleLabel } from "@rollcol/shared";
import { Link, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { usePalette } from "@/components/theme";
import { Body, Card, Message, Title } from "@/components/ui";
import { TodayRegisters } from "@/components/today-registers";
import { syncOutbox } from "@/lib/registers";
import { useSession } from "@/lib/session";

export default function HomeScreen() {
  const { member, memberships, refresh } = useSession();
  const palette = usePalette();
  const [refreshing, setRefreshing] = useState(false);
  // Bumped on pull-to-refresh and when returning to this screen, so lists reload.
  const [refreshKey, setRefreshKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setRefreshKey((key) => key + 1);
    }, []),
  );

  if (!member || member.kind === "none") return null;
  const { school } = member;

  async function onRefresh() {
    setRefreshing(true);
    await syncOutbox();
    await refresh();
    setRefreshKey((key) => key + 1);
    setRefreshing(false);
  }

  const roleLine =
    member.kind === "student" ? `Student · ${member.schoolNumber}` : `${staffRoleLabel(member.role, school.type)} · ${member.schoolNumber}`;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} />}
    >
      <View style={styles.header}>
        <Title>Hello, {member.fullName.split(" ")[0]}</Title>
        <Body muted>
          {school.name} · {roleLine}
        </Body>
      </View>

      {member.status === "pending" ? (
        <Message tone="warning">
          Your school has not approved your account yet. You can check in once an admin approves you. Pull down to check again.
        </Message>
      ) : null}
      {member.status === "disabled" ? (
        <Message>Your school has turned off your account. Speak to your school admin if this is a mistake.</Message>
      ) : null}

      {member.status === "active" ? (
        <Card>
          {member.kind === "student" ? (
            <>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Check-in</Text>
              <Body muted>
                Joining your courses and checking in to sessions arrive in the next update. Your account is ready for this{" "}
                {periodWord(school.type)}.
              </Body>
            </>
          ) : school.type === "tertiary" ? (
            <>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Sessions</Text>
              <Body muted>Starting check-in sessions for your courses arrives in the next update.</Body>
            </>
          ) : (
            <>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Today&apos;s registers</Text>
              <TodayRegisters schoolId={school.id} perPeriod={school.registerMode === "per_period"} refreshKey={refreshKey} />
            </>
          )}
        </Card>
      ) : null}

      <Link href="/schools" style={[styles.link, { color: palette.accent }]}>
        {memberships.length > 1 ? `Switch school (${memberships.length} schools)` : "Your schools"}
      </Link>
      <Link href="/account" style={[styles.link, { color: palette.accent }]}>
        Your account
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 16 },
  header: { gap: 4 },
  cardTitle: { fontSize: 17, fontWeight: "600" },
  link: { fontSize: 16, fontWeight: "600" },
});
