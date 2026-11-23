"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Notice, buttonClass } from "@/components/ui";
import { type PaymentCheck, checkPendingPayments } from "./actions";

/**
 * Shown while a payment is not completed. Asks Paystack straight away, then
 * every 15 seconds for two minutes, and refreshes the page once a payment is
 * applied. The admin can also check again by hand.
 */
export function PaymentCheckNotice({ cameBack }: { cameBack: boolean }) {
  const router = useRouter();
  const [result, setResult] = useState<PaymentCheck | null>(null);
  const [checking, setChecking] = useState(true);
  const tries = useRef(0);

  const settle = useCallback(
    (next: PaymentCheck) => {
      setResult(next);
      setChecking(false);
      if (next.applied > 0) router.replace("/dashboard/billing?paid=1");
    },
    [router],
  );
  const check = useCallback(
    () =>
      checkPendingPayments().then(settle, () =>
        settle({ applied: 0, waiting: 0, problem: "This page could not reach the server. Check your connection." }),
      ),
    [settle],
  );

  useEffect(() => {
    void check();
    const timer = setInterval(() => {
      tries.current += 1;
      if (tries.current > 8) {
        clearInterval(timer);
        return;
      }
      void check();
    }, 15000);
    return () => clearInterval(timer);
  }, [check]);

  const problem = result?.problem;
  const title = problem ? "We could not confirm the payment" : cameBack ? "Waiting for Paystack" : "A payment is not completed";
  return (
    <Notice tone={problem ? "warning" : "accent"} title={title}>
      <span className="block">
        {problem
          ? `${problem} If you paid, nothing is lost: the payment is applied as soon as Paystack confirms it.`
          : cameBack
            ? "Paystack has not confirmed the payment yet. Mobile Money can take a minute. This page checks by itself and shows it as paid once it is."
            : "If you paid and it still shows as not completed, check again. Unfinished payments are never charged."}
      </span>
      <button
        type="button"
        className={`${buttonClass("secondary", "sm")} mt-3`}
        onClick={() => {
          setChecking(true);
          void check();
        }}
        disabled={checking}
      >
        {checking ? "Checking..." : "Check again"}
      </button>
    </Notice>
  );
}
