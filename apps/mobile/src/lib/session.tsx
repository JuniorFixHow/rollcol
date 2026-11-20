import { type Member, describeDatabaseError, pendingStudentJoinSchema, toMember } from "@rollcol/shared";
import type { Session } from "@supabase/supabase-js";
import { createContext, type ReactNode, use, useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

interface SessionState {
  loading: boolean;
  session: Session | null;
  member: Member | null;
  /** Set when finishing a saved school join failed, so the join screen can explain. */
  joinError: string | null;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

async function loadMember(): Promise<{ member: Member; joinError: string | null }> {
  const { data, error } = await supabase.rpc("current_member");
  if (error) throw error;
  const member = toMember(data[0]);
  if (member.kind !== "none") return { member, joinError: null };

  // A student who signed up and then confirmed their email: finish joining now.
  const { data: userData } = await supabase.auth.getUser();
  const pending = pendingStudentJoinSchema.safeParse(userData.user?.user_metadata);
  if (!pending.success) return { member, joinError: null };

  const join = pending.data.pending_join;
  const { error: joinError } = await supabase.rpc("join_school_as_student", {
    p_school_code: join.school_code,
    p_school_number: join.school_id,
    p_full_name: join.full_name,
  });
  if (joinError) return { member, joinError: describeDatabaseError(joinError) };

  await supabase.auth.updateUser({ data: { pending_join: null } });
  const { data: after } = await supabase.rpc("current_member");
  return { member: toMember(after?.[0]), joinError: null };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    if (!data.session) {
      setMember(null);
      return;
    }
    try {
      const result = await loadMember();
      setMember(result.member);
      setJoinError(result.joinError);
    } catch {
      // Offline or a server problem: keep what we had rather than signing out.
    }
  }, []);

  useEffect(() => {
    let active = true;
    void refresh().finally(() => {
      if (active) setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        // Supabase advises against awaiting other calls inside this callback.
        setTimeout(() => void refresh(), 0);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [refresh]);

  return <SessionContext value={{ loading, session, member, joinError, refresh }}>{children}</SessionContext>;
}

export function useSession(): SessionState {
  const value = use(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
