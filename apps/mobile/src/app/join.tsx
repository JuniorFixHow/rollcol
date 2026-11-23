import { StyleSheet, View } from "react-native";
import { JoinSchoolForm } from "@/components/join-school-form";
import { Body, Button, Screen, Title, Logo } from "@/components/ui";
import { forgetThisPhonesPush } from "@/lib/push";
import { supabase } from "@/lib/supabase";

/** Signed in, but not part of a school yet. */
export default function JoinScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Logo />
        <Title>Join your school</Title>
        <Body muted>
          Students: enter your school code and school ID. Teachers and lecturers: ask your school admin to invite you, then
          sign in with the details from the invite email.
        </Body>
      </View>
      <JoinSchoolForm />
      <Button label="Sign out" variant="link" onPress={() => void forgetThisPhonesPush().then(() => supabase.auth.signOut({ scope: "local" }))} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4, marginTop: 24 },
});
