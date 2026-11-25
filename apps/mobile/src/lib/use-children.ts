import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/** The parent's linked children, as choices (id and full name). */
export function useChildChoices(): { value: string; label: string }[] {
  const [choices, setChoices] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    void supabase.rpc("parent_children").then(({ data }) => {
      setChoices((data ?? []).flatMap((c) => (c.student_id && c.full_name ? [{ value: c.student_id, label: c.full_name }] : [])));
    });
  }, []);
  return choices;
}
