import { describeDatabaseError } from "@rollcol/shared";
import { createContext, type ReactNode, use, useCallback, useEffect, useState } from "react";
import { type PhoneStatus, loadPhoneStatus, registerThisPhone } from "./device";
import { registerForPush, registerStaffPush, useNotificationTaps } from "./push";

function describePhoneError(caught: unknown): string {
  const offline = "RollCol could not check this phone. Check your connection and pull down to try again.";
  if (typeof caught === "object" && caught !== null && "message" in caught && typeof caught.message === "string") {
    if (/network|fetch/i.test(caught.message)) return offline;
    return describeDatabaseError({ message: caught.message, code: "code" in caught && typeof caught.code === "string" ? caught.code : undefined });
  }
  return offline;
}

interface PhoneState {
  phone: PhoneStatus | null;
  /** Why registering failed: offline, or this phone belongs to another student. */
  error: string | null;
  refresh: () => Promise<void>;
}

const PhoneContext = createContext<PhoneState>({ phone: null, error: null, refresh: async () => undefined });

/**
 * For students: registers this phone (binding) and its push token after
 * sign-in. Staff do not register phones, only a push token.
 */
export function PhoneProvider({ isStudent, children }: { isStudent: boolean; children: ReactNode }) {
  const [phone, setPhone] = useState<PhoneStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  useNotificationTaps(true);

  // Staff: only the push token, no phone binding.
  useEffect(() => {
    if (isStudent) return;
    void registerStaffPush().catch(() => undefined);
  }, [isStudent]);

  useEffect(() => {
    if (!isStudent) return;
    let cancelled = false;
    void (async () => {
      try {
        const status = await registerThisPhone();
        if (cancelled) return;
        setPhone(status);
        setError(null);
        if (status.status === "active") await registerForPush();
      } catch (caught) {
        if (!cancelled) setError(describePhoneError(caught));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isStudent]);

  const refresh = useCallback(async () => {
    if (!isStudent) return;
    try {
      const status = phone ? await loadPhoneStatus() : await registerThisPhone();
      setPhone(status);
      setError(null);
      if (status.status === "active") await registerForPush();
    } catch (caught) {
      setError(describePhoneError(caught));
    }
  }, [isStudent, phone]);

  return <PhoneContext value={{ phone, error, refresh }}>{children}</PhoneContext>;
}

export function usePhone(): PhoneState {
  return use(PhoneContext);
}
