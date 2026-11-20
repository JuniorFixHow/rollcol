import {
  type Member,
  type Membership,
  chooseMember,
  describeDatabaseError,
  pendingStudentJoinSchema,
  toMemberships,
} from "@rollcol/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { createContext, type ReactNode, use, useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

/** The school shown in the app, for people who belong to more than one. */
const ACTIVE_SCHOOL_KEY = "rollcol.activeSchoolId";
/** The school code used to sign in, so that school opens first. Cleared once used. */
const SIGN_IN_SCHOOL_CODE_KEY = "rollcol.signInSchoolCode";

interface SessionState {
  loading: boolean;
  session: Session | null;
  /** The school on screen. */
  member: Member | null;
  /** Every school this person belongs to. */
  memberships: Membership[];
  /** Set when finishing a saved school join failed, so the join screen can explain. */
  joinError: string | null;
  refresh: () => Promise<void>;
  switchSchool: (schoolId: string) => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

async function fetchMemberships(): Promise<{ memberships: Membership[]; isPlatformAdmin: boolean }> {
  const [{ data, error }, { data: isAdmin }] = await Promise.all([
    supabase.rpc("my_memberships"),
    supabase.rpc("is_platform_admin"),
  ]);
  if (error) throw error;
  return { memberships: toMemberships(data, isAdmin === true), isPlatformAdmin: isAdmin === true };
}

/**
 * Loads every membership. A student who signed up and then confirmed their
 * email has a saved join: finish it now, and show that school.
 */
async function loadMemberships(): Promise<{
  memberships: Membership[];
  isPlatformAdmin: boolean;
  joinError: string | null;
  joinedSchoolCode: string | null;
}> {
  const first = await fetchMemberships();

  const { data: userData } = await supabase.auth.getUser();
  const pending = pendingStudentJoinSchema.safeParse(userData.user?.user_metadata);
  if (!pending.success) return { ...first, joinError: null, joinedSchoolCode: null };

  const join = pending.data.pending_join;
  const alreadyJoined = first.memberships.some((m) => m.school.code === join.school_code);
  if (!alreadyJoined) {
    const { error: joinError } = await supabase.rpc("join_school_as_student", {
      p_school_code: join.school_code,
      p_school_number: join.school_id,
      p_full_name: join.full_name,
    });
    if (joinError) return { ...first, joinError: describeDatabaseError(joinError), joinedSchoolCode: null };
  }

  await supabase.auth.updateUser({ data: { pending_join: null } });
  const after = await fetchMemberships();
  return { ...after, joinError: null, joinedSchoolCode: join.school_code };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [member, setMember] = useState<Member | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const platformAdmin = useRef(false);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    if (!data.session) {
      setMemberships([]);
      setMember(null);
      return;
    }
    try {
      const result = await loadMemberships();
      platformAdmin.current = result.isPlatformAdmin;

      let preferredSchoolId = await AsyncStorage.getItem(ACTIVE_SCHOOL_KEY);
      const signInCode = await AsyncStorage.getItem(SIGN_IN_SCHOOL_CODE_KEY);
      const openCode = result.joinedSchoolCode ?? signInCode;
      if (openCode) {
        const match = result.memberships.find((m) => m.school.code === openCode);
        if (match) {
          preferredSchoolId = match.school.id;
          await AsyncStorage.setItem(ACTIVE_SCHOOL_KEY, match.school.id);
        }
      }
      if (signInCode) await AsyncStorage.removeItem(SIGN_IN_SCHOOL_CODE_KEY);

      setMemberships(result.memberships);
      setMember(chooseMember(result.memberships, result.isPlatformAdmin, { preferredSchoolId }));
      setJoinError(result.joinError);
    } catch {
      // Offline or a server problem: keep what we had rather than signing out.
    }
  }, []);

  const switchSchool = useCallback(
    async (schoolId: string) => {
      await AsyncStorage.setItem(ACTIVE_SCHOOL_KEY, schoolId);
      setMember(chooseMember(memberships, platformAdmin.current, { preferredSchoolId: schoolId }));
    },
    [memberships],
  );

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

  return (
    <SessionContext value={{ loading, session, member, memberships, joinError, refresh, switchSchool }}>
      {children}
    </SessionContext>
  );
}

/**
 * Called by the sign-in screen just before signing in: the school whose code
 * was used opens first. Pass null for email sign-in.
 */
export async function setSignInSchoolCode(schoolCode: string | null): Promise<void> {
  if (schoolCode) await AsyncStorage.setItem(SIGN_IN_SCHOOL_CODE_KEY, schoolCode);
  else await AsyncStorage.removeItem(SIGN_IN_SCHOOL_CODE_KEY);
}

/** Called on sign-out, so the next person on this phone starts fresh. */
export async function forgetActiveSchool(): Promise<void> {
  await AsyncStorage.multiRemove([ACTIVE_SCHOOL_KEY, SIGN_IN_SCHOOL_CODE_KEY]);
}

export function useSession(): SessionState {
  const value = use(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
