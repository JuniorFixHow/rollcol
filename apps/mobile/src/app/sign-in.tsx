import { emailSignInSchema, schoolIdSignInSchema } from "@rollcol/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Link } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ParentSignIn } from "@/components/parent-sign-in";
import { usePalette } from "@/components/theme";
import { Body, Button, Field, LegalLinks, Message, Screen, Title, Logo } from "@/components/ui";
import { setSignInSchoolCode } from "@/lib/session";
import { WEB_URL, supabase } from "@/lib/supabase";

const LAST_SCHOOL_CODE = "rollcol.lastSchoolCode";
const WRONG_DETAILS = "Those sign-in details are not right. Check them and try again.";

function lookupEmail(value: unknown): { status: "ok"; email: string } | { status: "locked" | "invalid" } {
  if (typeof value !== "object" || value === null) return { status: "invalid" };
  const status = "status" in value ? value.status : undefined;
  const email = "email" in value ? value.email : undefined;
  if (status === "ok" && typeof email === "string") return { status: "ok", email };
  return { status: status === "locked" ? "locked" : "invalid" };
}

export default function SignInScreen() {
  const palette = usePalette();
  const [method, setMethod] = useState<"school" | "email" | "parent">("school");
  const [schoolCode, setSchoolCode] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(LAST_SCHOOL_CODE).then((code) => {
      if (code) setSchoolCode(code);
    });
  }, []);

  async function signIn() {
    setError(null);
    setBusy(true);
    try {
      let signInEmail: string;
      if (method === "school") {
        const parsed = schoolIdSignInSchema.safeParse({ schoolCode, schoolId, password });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? WRONG_DETAILS);
          return;
        }
        const { data, error: rpcError } = await supabase.rpc("sign_in_email", {
          p_school_code: parsed.data.schoolCode,
          p_school_number: parsed.data.schoolId,
          p_password: parsed.data.password,
        });
        if (rpcError) {
          setError("We could not reach RollCol. Check your connection and try again.");
          return;
        }
        const result = lookupEmail(data);
        if (result.status === "locked") {
          setError("Too many attempts with this school ID. Wait 15 minutes, then try again.");
          return;
        }
        if (result.status !== "ok") {
          setError(WRONG_DETAILS);
          return;
        }
        signInEmail = result.email;
        await AsyncStorage.setItem(LAST_SCHOOL_CODE, parsed.data.schoolCode);
      } else {
        const parsed = emailSignInSchema.safeParse({ email, password });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? WRONG_DETAILS);
          return;
        }
        signInEmail = parsed.data.email;
      }

      await setSignInSchoolCode(method === "school" ? schoolCode.replace(/\s/g, "").toUpperCase() : null);
      const { error: authError } = await supabase.auth.signInWithPassword({ email: signInEmail, password });
      if (authError) {
        if (authError.code === "email_not_confirmed") setError("Confirm your email first. Open the link we sent you, then sign in.");
        else if (authError.status === 429) setError("Too many attempts. Wait a few minutes, then try again.");
        else setError(WRONG_DETAILS);
      }
      // On success the session provider moves to the right screen.
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Logo />
        <Title>Sign in to RollCol</Title>
        <Body muted>For students, teachers, lecturers and parents.</Body>
      </View>

      <View style={[styles.tabs, { backgroundColor: palette.surfaceMuted }]} accessibilityRole="tablist">
        {(
          [
            ["school", "School ID"],
            ["email", "Email"],
            ["parent", "Parent"],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: method === value }}
            onPress={() => {
              setMethod(value);
              setError(null);
            }}
            style={[styles.tab, method === value && { backgroundColor: palette.surface }]}
          >
            <Text style={{ color: method === value ? palette.text : palette.muted, fontWeight: "600" }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {method === "parent" ? (
        <ParentSignIn />
      ) : (
        <>
          {method === "school" ? (
            <>
              <Field
                label="School code"
                hint="Six letters or numbers from your school."
                value={schoolCode}
                onChangeText={setSchoolCode}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Field label="School ID" value={schoolId} onChangeText={setSchoolId} autoCapitalize="characters" autoCorrect={false} textContentType="username" />
            </>
          ) : (
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />
          )}
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" onSubmitEditing={signIn} />

          {error ? <Message>{error}</Message> : null}
          <Button label="Sign in" onPress={signIn} busy={busy} />
          <Button label="Forgot password?" variant="link" onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}/forgot-password`)} />
        </>
      )}

      {method === "parent" ? null : (
        <View style={styles.footer}>
          <Body muted>New student at a university or college?</Body>
          <Link href="/sign-up" style={{ color: palette.accent, fontWeight: "600", fontSize: 15 }}>
            Create your account
          </Link>
        </View>
      )}
      <LegalLinks />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4, marginTop: 24 },
  tabs: { flexDirection: "row", borderRadius: 8, padding: 4 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 6 },
  footer: { alignItems: "center", gap: 4, marginTop: 8 },
});
