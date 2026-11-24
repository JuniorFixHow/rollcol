import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Body, Button, Field, Message, Screen } from "@/components/ui";
import { supabase } from "@/lib/supabase";

/**
 * Links the parent's account to their children: the number must be on the
 * school's guardian record, and the parent types one of a child's names, so a
 * person who got a recycled number cannot see another family's children.
 */
export default function LinkChildScreen() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function link() {
    setError(null);
    setNotice(null);
    if (name.trim().length < 2) {
      setError("Type one of your child's names, as the school has it.");
      return;
    }
    setBusy(true);
    try {
      const { data, error: linkError } = await supabase.rpc("parent_link_children", { p_name: name.trim() });
      if (linkError) {
        setError(
          /too many tries/i.test(linkError.message)
            ? "Too many tries. Try again tomorrow, or ask the school to check your child's name."
            : /network|fetch/i.test(linkError.message)
              ? "We could not reach RollCol. Check your connection and try again."
              : "RollCol could not link your child. Please try again.",
        );
        return;
      }
      const result = data[0];
      if (!result || result.linked + result.pending === 0) {
        setError("That name does not match a child on the school's records with your number. Check the spelling and try again.");
        return;
      }
      if (result.remaining > 0) {
        setName("");
        setNotice(
          result.pending > 0
            ? "Done. The school will confirm the link. Another school also has your number: type the name of your child there."
            : "Linked. Another school also has your number: type the name of your child there.",
        );
        return;
      }
      router.back();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.group}>
        <Body>
          Type one of your child&apos;s names, as the school has it. Your other children at the same school appear
          too.
        </Body>
        <Field
          label="Child's name"
          hint="First name or surname, for example Abena."
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoCorrect={false}
          onSubmitEditing={() => void link()}
        />
        {error ? <Message>{error}</Message> : null}
        {notice ? <Message tone="accent">{notice}</Message> : null}
        <Button label="Link" onPress={() => void link()} busy={busy} />
        {notice ? <Button label="Done" variant="secondary" onPress={() => router.back()} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ group: { gap: 16 } });
