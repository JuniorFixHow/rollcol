import { describeDatabaseError, formatPhoneForDisplay, normalisePhone } from "@rollcol/shared";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ChoiceChips } from "@/components/choice-chips";
import { usePalette } from "@/components/theme";
import { Body, Button, Field, Message } from "@/components/ui";
import { supabase } from "@/lib/supabase";

interface Link {
  id: string;
  school_id: string;
  school_name: string;
}

interface Request {
  id: string;
  school_id: string;
  new_phone: string;
}

/** Asks a school to use a new phone number for the parent. */
export default function NumberChangeScreen() {
  const palette = usePalette();
  const [links, setLinks] = useState<Link[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [school, setSchool] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [l, r] = await Promise.all([
      supabase.rpc("parent_my_links"),
      supabase.from("guardian_phone_requests").select("id, school_id, new_phone").eq("status", "pending"),
    ]);
    const active = (l.data ?? []).filter((x) => x.status === "active");
    setLinks(active);
    setRequests(r.data ?? []);
    if (active.length === 1 && active[0]) setSchool(active[0].id);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function send() {
    setError(null);
    setNotice(null);
    const normalised = normalisePhone(phone);
    if (!school) {
      setError("Choose the school.");
      return;
    }
    if (!normalised) {
      setError("Enter the new number, for example 024 123 4567.");
      return;
    }
    setBusy(true);
    const { error: sendError } = await supabase.rpc("parent_request_phone_change", { p_link_id: school, p_new_phone: normalised });
    setBusy(false);
    if (sendError) {
      setError(describeDatabaseError(sendError));
      return;
    }
    setPhone("");
    setNotice("Sent. The school will check it; you are told when it is approved.");
    void load();
  }

  async function cancel(id: string) {
    await supabase.rpc("parent_cancel_phone_change", { p_id: id });
    void load();
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Body>
        Got a new number? Ask each school to use it. Once a school approves, it sends messages to the new number, and you sign in to
        RollCol with it.
      </Body>
      {requests.map((r) => (
        <View key={r.id} style={[styles.item, { backgroundColor: palette.surface, borderColor: palette.line }]}>
          <Text style={[styles.title, { color: palette.text }]}>
            {links.find((l) => l.school_id === r.school_id)?.school_name ?? "A school"}
          </Text>
          <Text style={{ color: palette.muted }}>Waiting: you asked to use {formatPhoneForDisplay(r.new_phone)}.</Text>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => void cancel(r.id)} style={styles.cancel}>
            <Text style={{ color: palette.danger, fontWeight: "600" }}>Cancel</Text>
          </Pressable>
        </View>
      ))}
      {links.length > 1 ? (
        <ChoiceChips label="School" options={links.map((l) => ({ value: l.id, label: l.school_name }))} value={school} onChange={setSchool} />
      ) : null}
      <Field label="New number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" textContentType="telephoneNumber" />
      {error ? <Message>{error}</Message> : null}
      {notice ? <Message tone="accent">{notice}</Message> : null}
      <Button label="Ask the school" onPress={() => void send()} busy={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 16 },
  item: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 4 },
  title: { fontSize: 16, fontWeight: "600" },
  cancel: { alignSelf: "flex-start", marginTop: 4 },
});
