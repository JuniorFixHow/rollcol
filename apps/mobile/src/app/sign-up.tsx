import { describeDatabaseError, studentSignUpSchema } from "@rollcol/shared";
import { Link } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { usePalette } from "@/components/theme";
import { Body, Button, Card, Field, LegalLinks, Message, Screen, Title } from "@/components/ui";
import { WEB_URL, supabase } from "@/lib/supabase";

type FieldName = "schoolCode" | "schoolId" | "fullName" | "email" | "password";

export default function SignUpScreen() {
  const palette = usePalette();
  const [values, setValues] = useState<Record<FieldName, string>>({
    schoolCode: "",
    schoolId: "",
    fullName: "",
    email: "",
    password: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [school, setSchool] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (name: FieldName) => (text: string) => setValues((current) => ({ ...current, [name]: text }));

  async function checkSchool() {
    const code = values.schoolCode.trim();
    if (code.length < 6) return;
    const { data } = await supabase.rpc("school_by_code", { p_code: code });
    const found = data?.[0];
    if (!found) setSchool(null);
    else setSchool(found.accepts_students ? found.name : `${found.name} (students cannot sign up here)`);
  }

  async function signUp() {
    setError(null);
    setFieldErrors({});
    const parsed = studentSignUpSchema.safeParse(values);
    if (!parsed.success) {
      const errors: Partial<Record<FieldName, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && key in values && !errors[key as FieldName]) errors[key as FieldName] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    const input = parsed.data;
    setBusy(true);
    try {
      const { data: schools } = await supabase.rpc("school_by_code", { p_code: input.schoolCode });
      const found = schools?.[0];
      if (!found) {
        setFieldErrors({ schoolCode: "No school uses that code. Check it with your school." });
        return;
      }
      if (!found.accepts_students) {
        setError(
          found.type === "tertiary"
            ? `${found.name} is not taking new student accounts right now. Ask your school.`
            : `Students at ${found.name} do not need accounts. Your teachers take the register.`,
        );
        return;
      }

      const pendingJoin = { school_code: input.schoolCode, school_id: input.schoolId, full_name: input.fullName };
      const { data, error: authError } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          emailRedirectTo: `${WEB_URL}/auth/confirm?next=/students-use-the-app`,
          data: { full_name: input.fullName, pending_join: pendingJoin },
        },
      });
      if (authError) {
        setError(
          authError.code === "user_already_exists"
            ? "An account with this email already exists. Sign in instead."
            : authError.status === 429
              ? "Too many sign-ups. Wait a few minutes, then try again."
              : "We could not create your account. Please try again.",
        );
        return;
      }
      if (data.user && data.user.identities?.length === 0) {
        setError("An account with this email already exists. Sign in instead.");
        return;
      }
      if (!data.session) {
        setCheckEmail(true);
        return;
      }

      // Signed in straight away (email confirmation off): join now.
      const { error: joinError } = await supabase.rpc("join_school_as_student", {
        p_school_code: pendingJoin.school_code,
        p_school_number: pendingJoin.school_id,
        p_full_name: pendingJoin.full_name,
      });
      if (joinError) setError(describeDatabaseError(joinError));
      else await supabase.auth.updateUser({ data: { pending_join: null } });
      // The session provider moves to the next screen.
    } finally {
      setBusy(false);
    }
  }

  if (checkEmail) {
    return (
      <Screen>
        <View style={styles.header}>
          <Title>Check your email</Title>
          <Body muted>
            We sent a link to {values.email.trim()}. Open it to confirm your address, then come back and sign in with your school
            code, school ID and password.
          </Body>
        </View>
        <Link href="/sign-in" style={{ color: palette.accent, fontWeight: "600", fontSize: 16, textAlign: "center" }}>
          Go to sign in
        </Link>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Title>Create your student account</Title>
        <Body muted>For universities, colleges and polytechnics that use RollCol for check-in.</Body>
      </View>

      <Field
        label="School code"
        hint="Ask your school or lecturer for it."
        value={values.schoolCode}
        onChangeText={set("schoolCode")}
        onBlur={() => void checkSchool()}
        autoCapitalize="characters"
        autoCorrect={false}
        error={fieldErrors.schoolCode}
      />
      {school ? (
        <Card>
          <Body>{school}</Body>
        </Card>
      ) : null}
      <Field
        label="School ID"
        hint="Your student number, for example your index number."
        value={values.schoolId}
        onChangeText={set("schoolId")}
        autoCapitalize="characters"
        autoCorrect={false}
        error={fieldErrors.schoolId}
      />
      <Field label="Full name" value={values.fullName} onChangeText={set("fullName")} textContentType="name" error={fieldErrors.fullName} />
      <Field
        label="Email"
        value={values.email}
        onChangeText={set("email")}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        error={fieldErrors.email}
      />
      <Field
        label="Password"
        hint="At least 8 characters."
        value={values.password}
        onChangeText={set("password")}
        secureTextEntry
        textContentType="newPassword"
        error={fieldErrors.password}
      />

      {error ? <Message>{error}</Message> : null}
      <Button label="Create account" onPress={signUp} busy={busy} />
      <Link href="/sign-in" style={{ color: palette.accent, fontWeight: "600", fontSize: 15, textAlign: "center" }}>
        I already have an account
      </Link>
      <LegalLinks />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4, marginTop: 24 },
});
