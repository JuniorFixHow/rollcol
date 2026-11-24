import { formatPhoneForDisplay, normalisePhone } from "@rollcol/shared";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Body, Button, Field, Message } from "@/components/ui";
import { setSignInSchoolCode } from "@/lib/session";
import { supabase } from "@/lib/supabase";

const RESEND_SECONDS = 60;

/** Turns Supabase Auth's answer into words a parent understands. */
function describeSendError(error: { message: string; status?: number; code?: string }): string {
  if (error.status === 429 || error.code === "over_sms_send_rate_limit") {
    return "Too many codes were sent to this number. Wait a few minutes, then try again.";
  }
  if (/guardian list/i.test(error.message)) {
    return "This number is not on your child's school records in RollCol. Use the number the school has, or ask the school to add it.";
  }
  if (/test mode/i.test(error.message)) return "RollCol cannot send sign-in codes yet (SMS is in test mode).";
  if (/phone.*(disabled|provider)|unsupported phone/i.test(error.message)) {
    return "Signing in with a phone number is not switched on yet.";
  }
  if (/network|fetch/i.test(error.message)) return "We could not reach RollCol. Check your connection and try again.";
  return "RollCol could not send the code. Please try again in a moment.";
}

/**
 * Parents sign in with the phone number their child's school has, and a
 * six-digit code sent to it by SMS. No password.
 */
export function ParentSignIn() {
  const [phoneText, setPhoneText] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function sendCode(to: string) {
    setError(null);
    setBusy(true);
    try {
      const { error: sendError } = await supabase.auth.signInWithOtp({ phone: to });
      if (sendError) {
        setError(describeSendError(sendError));
        return;
      }
      setPhone(to);
      setCode("");
      setWait(RESEND_SECONDS);
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    const normalised = normalisePhone(phoneText);
    if (!normalised) {
      setError("Enter a phone number, for example 024 123 4567.");
      return;
    }
    await sendCode(normalised);
  }

  async function verify() {
    if (!phone) return;
    const token = code.replace(/\D/g, "");
    if (token.length !== 6) {
      setError("Enter the six-digit code from the SMS.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await setSignInSchoolCode(null);
      const { error: verifyError } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
      if (verifyError) {
        setError(
          verifyError.status === 429
            ? "Too many attempts. Wait a few minutes, then try again."
            : "That code is not right, or it has expired. Check it, or send a new code.",
        );
      }
      // On success the session provider opens the parent screens.
    } finally {
      setBusy(false);
    }
  }

  if (!phone) {
    return (
      <View style={styles.group}>
        <Field
          label="Phone number"
          hint="The number your child's school has for you."
          value={phoneText}
          onChangeText={setPhoneText}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          placeholder="024 123 4567"
          onSubmitEditing={() => void start()}
        />
        {error ? <Message>{error}</Message> : null}
        <Button label="Send code" onPress={() => void start()} busy={busy} />
        <Body muted>We send a six-digit code to this number by SMS. You do not need a password.</Body>
      </View>
    );
  }

  return (
    <View style={styles.group}>
      <Body>Enter the code we sent to {formatPhoneForDisplay(phone)}.</Body>
      <Field
        label="Code"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={6}
        placeholder="123456"
        onSubmitEditing={() => void verify()}
      />
      {error ? <Message>{error}</Message> : null}
      <Button label="Sign in" onPress={() => void verify()} busy={busy} />
      <Button
        label={wait > 0 ? `Send a new code in ${wait} s` : "Send a new code"}
        variant="secondary"
        disabled={wait > 0 || busy}
        onPress={() => void sendCode(phone)}
      />
      <Button
        label="Use another number"
        variant="link"
        onPress={() => {
          setPhone(null);
          setError(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ group: { gap: 16 } });
